-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "merchant_key" TEXT;

-- CreateTable
CREATE TABLE "merchant_rules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pattern_key" TEXT NOT NULL,
    "merchant_name" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "merchant_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_corrections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "merchant_key" TEXT,
    "from_category_id" UUID,
    "to_category_id" UUID NOT NULL,
    "applied_to_all" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_rules_user_id_pattern_key_key" ON "merchant_rules"("user_id", "pattern_key");

-- CreateIndex
CREATE INDEX "category_corrections_merchant_key_created_at_idx" ON "category_corrections"("merchant_key", "created_at");

-- CreateIndex
CREATE INDEX "category_corrections_user_id_idx" ON "category_corrections"("user_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_merchant_key_idx" ON "transactions"("user_id", "merchant_key");

-- AddForeignKey
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_corrections" ADD CONSTRAINT "category_corrections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill merchant_key with the same rule as merchantKey() in @et/domain:
-- upper case, every run of non letters/digits becomes one space, trimmed, empty → NULL.
UPDATE "transactions"
SET "merchant_key" = NULLIF(btrim(regexp_replace(upper("merchant_name"), '[^[:alnum:]]+', ' ', 'g')), '')
WHERE "merchant_name" IS NOT NULL;

-- Trigram search indexes, only where the pg_trgm extension is installed (same as prisma/sql/enable-trgm.sql).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX IF NOT EXISTS "transactions_merchant_name_trgm_idx" ON "transactions" USING gin ("merchant_name" gin_trgm_ops) WHERE "deleted_at" IS NULL;
    CREATE INDEX IF NOT EXISTS "transactions_note_trgm_idx" ON "transactions" USING gin ("note" gin_trgm_ops) WHERE "deleted_at" IS NULL;
  ELSE
    RAISE NOTICE 'pg_trgm is not installed on this server; ledger search will run without an index';
  END IF;
END
$$;
