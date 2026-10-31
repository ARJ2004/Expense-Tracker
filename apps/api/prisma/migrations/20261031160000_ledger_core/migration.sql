-- An account with transactions can't be deleted; the API answers ACCOUNT_IN_USE.
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_account_id_fkey";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "system_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "categories_system_key_key" ON "categories"("system_key");


-- System names are unique too (user_id is null, so the composite unique does not cover them).
CREATE UNIQUE INDEX "categories_system_name_key" ON "categories"("name") WHERE "user_id" IS NULL;

-- The 13 system categories, with the fixed ids from @et/domain SYSTEM_CATEGORIES.
INSERT INTO "categories" ("id", "user_id", "name", "icon", "color", "is_expense", "system_key", "sort_order") VALUES
  ('00000000-0000-7000-8000-000000000001', NULL, 'Food & Dining', 'food', 'chart2', true, 'food_dining', 1),
  ('00000000-0000-7000-8000-000000000002', NULL, 'Groceries', 'groceries', 'chart3', true, 'groceries', 2),
  ('00000000-0000-7000-8000-000000000003', NULL, 'Transport', 'transport', 'chart1', true, 'transport', 3),
  ('00000000-0000-7000-8000-000000000004', NULL, 'Shopping', 'shopping', 'warning', true, 'shopping', 4),
  ('00000000-0000-7000-8000-000000000005', NULL, 'Bills & Utilities', 'bills', 'chart5', true, 'bills_utilities', 5),
  ('00000000-0000-7000-8000-000000000006', NULL, 'Rent', 'rent', 'chart1', true, 'rent', 6),
  ('00000000-0000-7000-8000-000000000007', NULL, 'Entertainment', 'entertainment', 'chart3', true, 'entertainment', 7),
  ('00000000-0000-7000-8000-000000000008', NULL, 'Health', 'health', 'chart2', true, 'health', 8),
  ('00000000-0000-7000-8000-000000000009', NULL, 'Education', 'education', 'chart4', true, 'education', 9),
  ('00000000-0000-7000-8000-000000000010', NULL, 'Travel', 'travel', 'chart5', true, 'travel', 10),
  ('00000000-0000-7000-8000-000000000011', NULL, 'Transfers', 'transfer', 'muted', false, 'transfers', 11),
  ('00000000-0000-7000-8000-000000000012', NULL, 'Income', 'income', 'accent', false, 'income', 12),
  ('00000000-0000-7000-8000-000000000013', NULL, 'Other', 'other', 'muted', true, 'other', 13);
