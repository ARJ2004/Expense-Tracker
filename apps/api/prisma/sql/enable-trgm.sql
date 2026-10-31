-- Trigram indexes for ledger search (q matches merchant or note with ILIKE '%…%').
-- Safe to run again. Needs the pg_trgm extension files on the server (postgresql15-contrib on
-- Amazon Linux); without them it only prints a notice and search runs unindexed.
-- Re-run after installing the package:  pnpm --filter @et/api db:trgm
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
