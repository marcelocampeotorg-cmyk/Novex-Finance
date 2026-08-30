-- AlterTable
ALTER TABLE "external_transactions" ADD COLUMN IF NOT EXISTS "raw_enrichment_data" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_sync_run_per_integration" ON "sync_runs" ("integration_account_id") WHERE status = 'PROCESSING';
