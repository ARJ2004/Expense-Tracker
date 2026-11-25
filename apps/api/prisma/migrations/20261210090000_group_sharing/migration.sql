-- F13 Group sharing: groups go from "owned by one user" to "shared by every linked member".
-- Existing F12 groups are carried over: the owner's "You" member is linked to the owner, the
-- group's archive moves onto that member, and the owner's member gets their first name (other
-- people will now see it; "You" is worked out per viewer).

-- 1. New columns, nullable or defaulted first.
ALTER TABLE "group_members"
  ADD COLUMN "user_id" UUID,
  ADD COLUMN "joined_at" TIMESTAMPTZ,
  ADD COLUMN "archived_at" TIMESTAMPTZ;
ALTER TABLE "groups"
  ADD COLUMN "owner_id" UUID,
  ADD COLUMN "rev" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "group_expenses"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "client_request_id" UUID;
ALTER TABLE "group_payments" ADD COLUMN "client_request_id" UUID;

-- 2. Carry F12 data over.
UPDATE "groups" SET "owner_id" = "user_id";
UPDATE "group_members" m
   SET "user_id" = g."user_id", "joined_at" = g."created_at", "archived_at" = g."archived_at"
  FROM "groups" g
 WHERE m."group_id" = g."id" AND m."is_self";

-- The owner's member was called "You". Name it after the owner (first word of their Google name,
-- else their email's local part); if someone in the group already has that name, add " (owner)".
WITH wanted AS (
  SELECT m."id", m."group_id",
         left(split_part(coalesce(nullif(trim(u."name"), ''), split_part(u."email", '@', 1)), ' ', 1), 22) AS "name"
    FROM "group_members" m JOIN "users" u ON u."id" = m."user_id"
   WHERE m."is_self"
)
UPDATE "group_members" m
   SET "name" = CASE WHEN clash THEN w."name" || ' (owner)' ELSE w."name" END,
       "name_key" = lower(CASE WHEN clash THEN w."name" || ' (owner)' ELSE w."name" END)
  FROM (SELECT w.*, EXISTS (SELECT 1 FROM "group_members" o
                             WHERE o."group_id" = w."group_id" AND o."id" <> w."id"
                               AND o."name_key" = lower(w."name")) AS clash
          FROM wanted w) w
 WHERE m."id" = w."id";

-- 3. Reshape: owner_id required and Restrict; archive and is_self leave groups / members.
ALTER TABLE "groups" DROP CONSTRAINT "groups_user_id_fkey";
DROP INDEX "groups_user_id_archived_at_idx";
ALTER TABLE "groups" ALTER COLUMN "owner_id" SET NOT NULL;
ALTER TABLE "groups" DROP COLUMN "user_id", DROP COLUMN "archived_at";
ALTER TABLE "group_members" DROP COLUMN "is_self";

-- 4. New tables.
CREATE TABLE "group_invites" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_events" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "actor_member_id" UUID,
    "type" VARCHAR(40) NOT NULL,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_events_pkey" PRIMARY KEY ("id")
);

-- 5. Indexes.
CREATE UNIQUE INDEX "group_invites_code_key" ON "group_invites"("code");
CREATE INDEX "group_invites_group_id_idx" ON "group_invites"("group_id");
-- At most one active link per group.
CREATE UNIQUE INDEX "group_invites_one_active" ON "group_invites"("group_id") WHERE "revoked_at" IS NULL;
CREATE INDEX "group_events_group_id_created_at_id_idx" ON "group_events"("group_id", "created_at" DESC, "id" DESC);
CREATE UNIQUE INDEX "group_expenses_group_id_client_request_id_key" ON "group_expenses"("group_id", "client_request_id");
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");
CREATE UNIQUE INDEX "group_payments_group_id_client_request_id_key" ON "group_payments"("group_id", "client_request_id");
CREATE INDEX "groups_owner_id_idx" ON "groups"("owner_id");

-- 6. Foreign keys.
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_events" ADD CONSTRAINT "group_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_events" ADD CONSTRAINT "group_events_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
