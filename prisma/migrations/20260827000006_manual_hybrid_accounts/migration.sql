CREATE TYPE "FinanceMode" AS ENUM ('MANUAL', 'HYBRID');
CREATE TYPE "FinancialAccountType" AS ENUM ('MANUAL', 'MERCADO_PAGO');

ALTER TABLE "workspaces"
  ADD COLUMN "finance_mode" "FinanceMode" NOT NULL DEFAULT 'MANUAL';

CREATE TABLE "financial_accounts" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "type" "FinancialAccountType" NOT NULL,
  "name" TEXT NOT NULL,
  "opening_balance_cents" BIGINT,
  "opening_balance_at" TIMESTAMP(3),
  "official_balance_cents" BIGINT,
  "official_balance_at" TIMESTAMP(3),
  "official_balance_status" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_accounts_workspace_id_type_key"
  ON "financial_accounts"("workspace_id", "type");

ALTER TABLE "integration_accounts"
  ADD COLUMN "financial_account_id" TEXT,
  ADD COLUMN "provider_account_created_at" TIMESTAMP(3),
  ADD COLUMN "history_backfill_status" TEXT NOT NULL DEFAULT 'NOT_STARTED';
CREATE UNIQUE INDEX "integration_accounts_financial_account_id_key"
  ON "integration_accounts"("financial_account_id");

ALTER TABLE "external_transactions"
  ADD COLUMN "financial_account_id" TEXT,
  ADD COLUMN "quarantined_at" TIMESTAMP(3),
  ADD COLUMN "quarantine_reason" TEXT;

ALTER TABLE "ledger_entries"
  ADD COLUMN "financial_account_id" TEXT,
  ADD COLUMN "reverses_entry_id" TEXT;
CREATE UNIQUE INDEX "ledger_entries_reverses_entry_id_key"
  ON "ledger_entries"("reverses_entry_id");

INSERT INTO "financial_accounts" ("id", "workspace_id", "type", "name", "updated_at")
SELECT gen_random_uuid()::text, w."id", 'MANUAL', 'Conta geral', CURRENT_TIMESTAMP
FROM "workspaces" w
ON CONFLICT ("workspace_id", "type") DO NOTHING;

INSERT INTO "financial_accounts" ("id", "workspace_id", "type", "name", "updated_at")
SELECT gen_random_uuid()::text, i."workspace_id", 'MERCADO_PAGO', 'Mercado Pago', CURRENT_TIMESTAMP
FROM "integration_accounts" i
WHERE i."provider" = 'MERCADO_PAGO'
ON CONFLICT ("workspace_id", "type") DO NOTHING;

UPDATE "integration_accounts" i
SET "financial_account_id" = a."id"
FROM "financial_accounts" a
WHERE a."workspace_id" = i."workspace_id" AND a."type" = 'MERCADO_PAGO' AND i."provider" = 'MERCADO_PAGO';

UPDATE "workspaces" w SET "finance_mode" = 'HYBRID'
WHERE EXISTS (
  SELECT 1 FROM "integration_accounts" i
  WHERE i."workspace_id" = w."id" AND i."provider" = 'MERCADO_PAGO' AND i."is_active" = true
);

UPDATE "external_transactions" e
SET "financial_account_id" = i."financial_account_id"
FROM "integration_accounts" i
WHERE e."integration_account_id" = i."id";

UPDATE "ledger_entries" l
SET "financial_account_id" = e."financial_account_id"
FROM "external_transactions" e
WHERE l."external_transaction_id" = e."id";

ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_financial_account_id_fkey"
  FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_transactions" ADD CONSTRAINT "external_transactions_financial_account_id_fkey"
  FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_financial_account_id_fkey"
  FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reverses_entry_id_fkey"
  FOREIGN KEY ("reverses_entry_id") REFERENCES "ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
