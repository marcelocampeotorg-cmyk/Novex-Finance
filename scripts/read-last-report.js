const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const prisma = new PrismaClient();

async function main() {
  const acc = await prisma.integrationAccount.findFirst({ where: { provider: "MERCADO_PAGO" } });
  const payload = JSON.parse(acc.encryptedCredentials);
  const key = Buffer.from(process.env.CREDENTIALS_ENCRYPTION_KEY_BASE64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, "base64")), decipher.final()]).toString("utf8");
  const creds = JSON.parse(plain);

  const fileName = "novex-settlement-manual-2026-09-02-071658.csv";
  const r = await fetch("https://api.mercadopago.com/v1/account/settlement_report/" + fileName, {
    headers: { Authorization: "Bearer " + creds.accessToken }
  });
  const csv = await r.text();
  const lines = csv.trim().split(/\r?\n/);
  console.log("Total lines in 08:16 report:", lines.length);
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    console.log(`Line ${i}: ${lines[i]}`);
  }
}

main().finally(() => prisma.$disconnect());
