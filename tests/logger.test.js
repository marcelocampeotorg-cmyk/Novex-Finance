const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("System Logger: sanitização de segredos e gravação estruturada", async () => {
  const { logger } = await import("../src/lib/logger.ts");

  const testSubsystem = "TEST_SUITE";
  const testMessage = "Mensagem de teste de auditoria";
  const sensitiveData = {
    apiKey: "secret-token-123456",
    userPassword: "MyPassword@2026",
    account: "12345",
    amountCents: 1500,
  };

  // Disparar log de auditoria
  logger.audit(testSubsystem, testMessage, sensitiveData);

  // Verificar arquivo
  const logsDir = path.resolve(process.cwd(), "logs");
  const auditPath = path.join(logsDir, "audit.log");
  assert.strictEqual(fs.existsSync(auditPath), true);

  const content = fs.readFileSync(auditPath, "utf8");
  assert.strictEqual(content.includes("[AUDIT]"), true);
  assert.strictEqual(content.includes("[TEST_SUITE]"), true);
  assert.strictEqual(content.includes(testMessage), true);
  // Segredos devem estar omitidos ([REDACTED])
  assert.strictEqual(content.includes("secret-token-123456"), false);
  assert.strictEqual(content.includes("MyPassword@2026"), false);
  assert.strictEqual(content.includes("[REDACTED]"), true);
  assert.strictEqual(content.includes('"amountCents":1500'), true);
});
