-- Sprint 6: a Cash system category for ATM withdrawals. The design doc counts ATM withdrawals as
-- spend, so they no longer sit in Transfers (which is not spend). Orders: ... Travel, Cash,
-- Transfers, Income, Other.
INSERT INTO "categories" ("id", "user_id", "name", "icon", "color", "is_expense", "system_key", "sort_order")
VALUES ('00000000-0000-7000-8000-000000000014', NULL, 'Cash', 'cash', 'chart4', true, 'cash', 11)
ON CONFLICT ("id") DO NOTHING;

UPDATE "categories" SET "sort_order" = 12 WHERE "id" = '00000000-0000-7000-8000-000000000011';
UPDATE "categories" SET "sort_order" = 13 WHERE "id" = '00000000-0000-7000-8000-000000000012';
UPDATE "categories" SET "sort_order" = 14 WHERE "id" = '00000000-0000-7000-8000-000000000013';

-- ATM withdrawals a rule put in Transfers move to Cash; ones the user categorized stay.
UPDATE "transactions"
SET "category_id" = '00000000-0000-7000-8000-000000000014'
WHERE "type" = 'atm_withdrawal'
  AND "category_source" = 'rule'
  AND "category_id" = '00000000-0000-7000-8000-000000000011';

UPDATE "import_rows"
SET "category_id" = '00000000-0000-7000-8000-000000000014'
WHERE "category_source" = 'rule'
  AND "category_id" = '00000000-0000-7000-8000-000000000011'
  AND "narration" ~* '^(ATW|NWD|ATM)\M|ATM (WDL|CASH|WITHDRAWAL)|CASH WITHDRAWAL';
