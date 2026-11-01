-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'reached', 'archived');

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "emoji" VARCHAR(16),
    "target_paise" BIGINT NOT NULL,
    "start_day" DATE NOT NULL,
    "target_day" DATE NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "reached_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contributions" (
    "id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "goal_contributions_goal_id_day_idx" ON "goal_contributions"("goal_id", "day");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Money is whole positive paise.
ALTER TABLE "goals" ADD CONSTRAINT "goals_target_paise_positive" CHECK ("target_paise" > 0);
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_amount_paise_positive" CHECK ("amount_paise" > 0);
