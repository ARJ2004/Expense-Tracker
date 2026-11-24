-- CreateEnum
CREATE TYPE "GroupSplitMode" AS ENUM ('equal', 'exact');

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "emoji" VARCHAR(16),
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "name_key" VARCHAR(30) NOT NULL,
    "is_self" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_expenses" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "description" VARCHAR(60) NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "paid_by_id" UUID NOT NULL,
    "split_mode" "GroupSplitMode" NOT NULL,
    "day" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "group_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_expense_shares" (
    "expense_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "share_paise" BIGINT NOT NULL,

    CONSTRAINT "group_expense_shares_pkey" PRIMARY KEY ("expense_id","member_id")
);

-- CreateTable
CREATE TABLE "group_payments" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "from_id" UUID NOT NULL,
    "to_id" UUID NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "day" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groups_user_id_archived_at_idx" ON "groups"("user_id", "archived_at");

-- CreateIndex
CREATE INDEX "group_members_group_id_position_idx" ON "group_members"("group_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_name_key_key" ON "group_members"("group_id", "name_key");

-- CreateIndex
CREATE INDEX "group_expenses_group_id_day_id_idx" ON "group_expenses"("group_id", "day" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "group_expense_shares_member_id_idx" ON "group_expense_shares"("member_id");

-- CreateIndex
CREATE INDEX "group_payments_group_id_day_id_idx" ON "group_payments"("group_id", "day" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_expenses" ADD CONSTRAINT "group_expenses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_expenses" ADD CONSTRAINT "group_expenses_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_expense_shares" ADD CONSTRAINT "group_expense_shares_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "group_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_expense_shares" ADD CONSTRAINT "group_expense_shares_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Money is whole paise: expenses and payments positive, a share may be 0 in an exact split.
ALTER TABLE "group_expenses" ADD CONSTRAINT "group_expenses_amount_paise_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "group_expense_shares" ADD CONSTRAINT "group_expense_shares_share_paise_not_negative" CHECK ("share_paise" >= 0);
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_amount_paise_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_two_members" CHECK ("from_id" <> "to_id");
