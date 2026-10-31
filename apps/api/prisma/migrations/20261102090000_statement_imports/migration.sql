-- Sprint 5: statement import (F6). statement_imports and import_rows are owned by the imports module.
-- file_bytes holds an upload only until the parse job reads it.

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('parsing', 'review', 'imported', 'failed');

-- CreateEnum
CREATE TYPE "ImportFormat" AS ENUM ('csv', 'xlsx');

-- CreateEnum
CREATE TYPE "ImportRowAction" AS ENUM ('import', 'skip');

-- CreateEnum
CREATE TYPE "ImportRowFlag" AS ENUM ('balance_mismatch', 'possible_duplicate');

-- CreateTable
CREATE TABLE "statement_imports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "file_bytes" BYTEA,
    "format" "ImportFormat" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'parsing',
    "adapter" TEXT,
    "bank_detected" TEXT,
    "last4_detected" VARCHAR(4),
    "account_id" UUID,
    "period_from" DATE,
    "period_to" DATE,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "new_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "flagged_count" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "merged_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "statement_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "row_no" INTEGER NOT NULL,
    "occurred_on" DATE NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "direction" "Direction" NOT NULL,
    "narration" TEXT NOT NULL,
    "merchant_name" TEXT,
    "reference_no" TEXT,
    "balance_paise" BIGINT,
    "nth" INTEGER NOT NULL DEFAULT 1,
    "category_id" UUID,
    "category_source" "CategorySource" NOT NULL DEFAULT 'default',
    "duplicate_of" UUID,
    "match_rule" TEXT,
    "flag" "ImportRowFlag",
    "action" "ImportRowAction" NOT NULL DEFAULT 'import',
    "edited_json" JSONB,
    "edited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "statement_imports_user_id_created_at_idx" ON "statement_imports"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "statement_imports_user_id_file_sha256_idx" ON "statement_imports"("user_id", "file_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_import_id_row_no_key" ON "import_rows"("import_id", "row_no");

-- AddForeignKey
ALTER TABLE "transaction_sources" ADD CONSTRAINT "transaction_sources_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "statement_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_imports" ADD CONSTRAINT "statement_imports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "statement_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Money is positive integer paise, as in transactions.
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_amount_paise_positive" CHECK ("amount_paise" > 0);
