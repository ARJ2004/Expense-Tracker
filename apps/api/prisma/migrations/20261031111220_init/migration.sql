-- CreateEnum
CREATE TYPE "IncomeFrequency" AS ENUM ('monthly', 'twice_monthly', 'weekly', 'irregular');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('savings', 'credit_card', 'wallet', 'cash');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "TxnType" AS ENUM ('expense', 'income', 'refund', 'transfer', 'atm_withdrawal', 'cash_deposit');

-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('rule', 'user', 'default');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('manual', 'sms', 'notification', 'statement');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "google_sub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "monthly_income_paise" BIGINT,
    "income_frequency" "IncomeFrequency",
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "onboarded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "masked_number" VARCHAR(4),
    "nickname" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "is_expense" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "amount_paise" BIGINT NOT NULL,
    "direction" "Direction" NOT NULL,
    "type" "TxnType" NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "merchant_name" TEXT,
    "category_id" UUID,
    "category_source" "CategorySource" NOT NULL DEFAULT 'default',
    "reference_no" TEXT,
    "note" TEXT,
    "user_edited" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_sources" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "source" "SourceKind" NOT NULL,
    "source_hash" TEXT NOT NULL,
    "raw_text" TEXT,
    "parsed_json" JSONB,
    "import_id" UUID,
    "received_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transaction_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_bank_name_masked_number_key" ON "accounts"("user_id", "bank_name", "masked_number");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_name_key" ON "categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "transactions_user_id_occurred_at_id_idx" ON "transactions"("user_id", "occurred_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "transactions_user_id_reference_no_idx" ON "transactions"("user_id", "reference_no");

-- CreateIndex
CREATE INDEX "transaction_sources_transaction_id_idx" ON "transaction_sources"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_sources_user_id_source_hash_key" ON "transaction_sources"("user_id", "source_hash");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_sources" ADD CONSTRAINT "transaction_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_sources" ADD CONSTRAINT "transaction_sources_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: Prisma cannot express CHECK constraints.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_paise_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "users" ADD CONSTRAINT "users_monthly_income_paise_non_negative" CHECK ("monthly_income_paise" IS NULL OR "monthly_income_paise" >= 0);
