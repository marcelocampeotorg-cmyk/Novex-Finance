-- Forward-only alignment for fields and constraints already present in schema.prisma.
ALTER TABLE "integration_accounts" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "integration_accounts" ADD COLUMN IF NOT EXISTS "first_imported_at" TIMESTAMP(3);
ALTER TABLE "integration_accounts" ADD COLUMN IF NOT EXISTS "coverage_start" TIMESTAMP(3);
ALTER TABLE "integration_accounts" ADD COLUMN IF NOT EXISTS "coverage_end" TIMESTAMP(3);

ALTER TABLE "external_transactions" ADD COLUMN IF NOT EXISTS "raw_provider_data" JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_external_transaction_id_key"
  ON "ledger_entries"("external_transaction_id") WHERE "external_transaction_id" IS NOT NULL;

ALTER TABLE "notification_events" ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "notification_events_dedupe_key_key"
  ON "notification_events"("dedupe_key") WHERE "dedupe_key" IS NOT NULL;

-- Banco, not read-before-write, serializes equivalent in-flight work.
CREATE UNIQUE INDEX IF NOT EXISTS "sync_runs_one_processing_per_account"
  ON "sync_runs"("workspace_id", "integration_account_id") WHERE "status" = 'PROCESSING';
CREATE UNIQUE INDEX IF NOT EXISTS "payment_intentions_one_waiting_per_installment"
  ON "payment_intentions"("workspace_id", "installment_id") WHERE "status" = 'WAITING';
