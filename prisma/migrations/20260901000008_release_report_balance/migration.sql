CREATE TABLE "balance_sync_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "integration_account_id" TEXT NOT NULL,
    "financial_account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "begin_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "remote_task_id" TEXT,
    "remote_report_id" TEXT,
    "remote_file_name" TEXT,
    "active_key" TEXT,
    "balance_cents" BIGINT,
    "requested_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "evidence_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balance_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "balance_sync_runs_active_key_key" ON "balance_sync_runs"("active_key");
CREATE UNIQUE INDEX "balance_sync_runs_integration_account_id_begin_date_end_date_key"
ON "balance_sync_runs"("integration_account_id", "begin_date", "end_date");

ALTER TABLE "balance_sync_runs"
ADD CONSTRAINT "balance_sync_runs_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "balance_sync_runs"
ADD CONSTRAINT "balance_sync_runs_integration_account_id_fkey"
FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "balance_sync_runs"
ADD CONSTRAINT "balance_sync_runs_financial_account_id_fkey"
FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_delivery_logs"
ADD COLUMN "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "next_retry_at" TIMESTAMP(3);
