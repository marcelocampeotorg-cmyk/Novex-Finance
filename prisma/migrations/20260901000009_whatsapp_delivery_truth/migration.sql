ALTER TABLE "whatsapp_delivery_logs"
ALTER COLUMN "sent_at" DROP DEFAULT,
ALTER COLUMN "sent_at" DROP NOT NULL;

UPDATE "whatsapp_delivery_logs"
SET "sent_at" = NULL
WHERE "status" NOT IN ('SENT', 'DELIVERED');
