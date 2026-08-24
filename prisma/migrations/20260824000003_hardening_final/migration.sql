-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MERCADO_PAGO_API', 'CSV_IMPORT', 'MANUAL_ADJUSTMENT');

-- DropIndex
DROP INDEX "external_transactions_integration_account_id_provider_exter_key";

-- AlterTable
ALTER TABLE "external_transactions" ADD COLUMN     "source" "TransactionSource" NOT NULL DEFAULT 'MERCADO_PAGO_API',
ALTER COLUMN "integration_account_id" DROP NOT NULL,
ALTER COLUMN "provider" DROP NOT NULL,
ALTER COLUMN "provider" DROP DEFAULT;

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "integration_account_id" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'MERCADO_PAGO_API',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "begin_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "remote_report_id" TEXT,
    "remote_file_name" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "inserted_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_transactions_workspace_id_source_external_id_key" ON "external_transactions"("workspace_id", "source", "external_id");

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_integration_account_id_fkey" FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

