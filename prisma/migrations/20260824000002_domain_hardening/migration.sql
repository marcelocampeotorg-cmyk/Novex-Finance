-- CreateTable
CREATE TABLE "payment_intentions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "financial_item_id" TEXT NOT NULL,
    "installment_id" TEXT NOT NULL,
    "favored_name" TEXT NOT NULL,
    "favored_pix_key" TEXT NOT NULL,
    "favored_pix_key_type" TEXT NOT NULL,
    "expected_amount_cents" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "txid" TEXT,
    "br_code_payload" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "confidence_score" INTEGER NOT NULL DEFAULT 80,
    "source" TEXT NOT NULL DEFAULT 'USER',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_delivery_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "charge_id" TEXT,
    "installment_id" TEXT,
    "message_type" TEXT NOT NULL,
    "remote_message_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_rules_workspace_id_pattern_key" ON "category_rules"("workspace_id", "pattern");

-- AddForeignKey
ALTER TABLE "payment_intentions" ADD CONSTRAINT "payment_intentions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intentions" ADD CONSTRAINT "payment_intentions_financial_item_id_fkey" FOREIGN KEY ("financial_item_id") REFERENCES "financial_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intentions" ADD CONSTRAINT "payment_intentions_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_delivery_logs" ADD CONSTRAINT "whatsapp_delivery_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_delivery_logs" ADD CONSTRAINT "whatsapp_delivery_logs_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "pix_charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_delivery_logs" ADD CONSTRAINT "whatsapp_delivery_logs_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
