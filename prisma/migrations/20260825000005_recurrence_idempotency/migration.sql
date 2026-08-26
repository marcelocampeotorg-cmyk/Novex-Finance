-- AlterTable
ALTER TABLE "financial_items" ADD COLUMN "scheduled_occurrence_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "financial_items_recurrence_rule_id_scheduled_occurrence_at_key" ON "financial_items"("recurrence_rule_id", "scheduled_occurrence_at");
