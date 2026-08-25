ALTER TABLE "sync_runs" ADD COLUMN "remote_task_id" TEXT;
ALTER TABLE "contacts" ADD COLUMN "merchant_city" TEXT;
ALTER TABLE "whatsapp_delivery_logs" ADD COLUMN "dedupe_key" TEXT;
UPDATE "whatsapp_delivery_logs" SET "dedupe_key" = 'legacy:' || "id" WHERE "dedupe_key" IS NULL;
ALTER TABLE "whatsapp_delivery_logs" ALTER COLUMN "dedupe_key" SET NOT NULL;

DROP INDEX IF EXISTS "ledger_entries_external_transaction_id_key";
CREATE UNIQUE INDEX "ledger_entries_external_transaction_id_key" ON "ledger_entries"("external_transaction_id");
DROP INDEX IF EXISTS "notification_events_dedupe_key_key";
CREATE UNIQUE INDEX "notification_events_dedupe_key_key" ON "notification_events"("dedupe_key");

CREATE UNIQUE INDEX "integration_accounts_one_active_provider"
  ON "integration_accounts"("workspace_id", "provider") WHERE "is_active" = true;
CREATE UNIQUE INDEX "reconciliations_one_active_match"
  ON "reconciliations"("external_transaction_id") WHERE "status" = 'MATCHED';
CREATE UNIQUE INDEX "whatsapp_delivery_logs_dedupe_key_key"
  ON "whatsapp_delivery_logs"("dedupe_key");
