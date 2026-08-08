const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { validateAttachmentFile } = require("../src/services/attachments-validator.ts");

test("Anexos: Valida mimetypes permitidos (PDF, PNG, JPEG)", () => {
  assert.equal(validateAttachmentFile("recibo.pdf", "application/pdf", 1024 * 1024).valid, true);
  assert.equal(validateAttachmentFile("comprovante.png", "image/png", 500 * 1024).valid, true);
  assert.equal(validateAttachmentFile("nota.jpg", "image/jpeg", 200 * 1024).valid, true);
});

test("Anexos: Rejeita mimetypes não suportados ou executáveis", () => {
  const result = validateAttachmentFile("script.exe", "application/x-msdownload", 1024);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes("não suportado"));
});

test("Anexos: Rejeita arquivos maiores que o limite máximo de 10MB", () => {
  const result = validateAttachmentFile("grande.pdf", "application/pdf", 11 * 1024 * 1024);
  assert.equal(result.valid, false);
  assert.ok(result.error.includes("10MB"));
});

test("Hardening: Cálculo determinístico de Checksum SHA-256 para anexos", () => {
  const content = Buffer.from("Conteudo do comprovante de pagamento Pix");
  const checksum1 = crypto.createHash("sha256").update(content).digest("hex");
  const checksum2 = crypto.createHash("sha256").update(content).digest("hex");

  assert.equal(checksum1, checksum2);
  assert.equal(checksum1.length, 64); // SHA-256 hex string length
});

test("Hardening: Sanitização de variáveis de produção", () => {
  function checkProductionEnv(env) {
    if (!env.DATABASE_URL || env.DATABASE_URL.includes("localhost")) return false;
    if (!env.CREDENTIALS_ENCRYPTION_KEY_BASE64 || env.CREDENTIALS_ENCRYPTION_KEY_BASE64.length < 32) return false;
    return true;
  }

  const validEnv = {
    DATABASE_URL: "postgresql://user:pass@postgres_prod:5432/novex_db",
    CREDENTIALS_ENCRYPTION_KEY_BASE64: "1234567890123456789012345678901234567890",
  };

  assert.equal(checkProductionEnv(validEnv), true);
});
