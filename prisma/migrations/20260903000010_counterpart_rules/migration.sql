-- CreateTable
CREATE TABLE "counterpart_rules" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "default_category_id" TEXT,
    "confidence_score" INTEGER NOT NULL DEFAULT 85,
    "source" TEXT NOT NULL DEFAULT 'OFFICIAL_STATEMENT',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counterpart_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "counterpart_rules_workspace_id_pattern_key" ON "counterpart_rules"("workspace_id", "pattern");

-- CreateIndex
CREATE INDEX "counterpart_rules_workspace_id_is_enabled_idx" ON "counterpart_rules"("workspace_id", "is_enabled");

-- AddForeignKey
ALTER TABLE "counterpart_rules" ADD CONSTRAINT "counterpart_rules_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counterpart_rules" ADD CONSTRAINT "counterpart_rules_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
