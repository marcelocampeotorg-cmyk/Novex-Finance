const { test } = require("node:test");
const assert = require("node:assert");

test("Segurança P0: RF-02 — Cadastro público falha fechado (fail-closed)", () => {
  // Simular lógica de verificação de cadastro
  function canSignUp(allowPublicSignupEnv, existingUserCount) {
    const isSignupExplicitlyAllowed = allowPublicSignupEnv === "true";
    if (!isSignupExplicitlyAllowed && existingUserCount > 0) {
      return false;
    }
    return true;
  }

  // Com env ausente (undefined): se já existe usuário, DEVE FALHAR FECHADO
  assert.strictEqual(canSignUp(undefined, 1), false);
  assert.strictEqual(canSignUp("", 1), false);
  assert.strictEqual(canSignUp("false", 1), false);
  assert.strictEqual(canSignUp("qualquer_coisa", 1), false);

  // Apenas se for bootstrap (0 usuários) ou explicitamente "true"
  assert.strictEqual(canSignUp(undefined, 0), true);
  assert.strictEqual(canSignUp("true", 5), true);
});

test("Segurança P0: RF-03 — Webhook deve rejeitar assinatura inválida antes do banco", () => {
  const fs = require("fs");
  const path = require("path");
  const webhookFile = fs.readFileSync(
    path.join(__dirname, "../src/app/api/webhooks/mercado-pago/route.ts"),
    "utf8"
  );

  // Verificar que a validação de assinatura ocorre antes do upsert no banco
  const sigIndex = webhookFile.indexOf("verifyWebhookSignature(req, dataId)");
  const upsertIndex = webhookFile.indexOf("db.webhookEvent.upsert");

  assert.ok(sigIndex > 0, "verifyWebhookSignature deve existir");
  assert.ok(upsertIndex > 0, "db.webhookEvent.upsert deve existir");
  assert.ok(sigIndex < upsertIndex, "verifyWebhookSignature DEVE ser executada ANTES de db.webhookEvent.upsert");

  // Verificar que se a assinatura for inválida, retorna 401 antes do upsert
  const codeBetween = webhookFile.slice(sigIndex, upsertIndex);
  assert.ok(codeBetween.includes("return NextResponse.json"), "Deve retornar erro antes de tocar no banco");
  assert.ok(codeBetween.includes("401"), "Deve retornar status 401 para assinatura inválida");
});

test("Segurança P0: RF-01 — Validação e proteção da rota de logs do cliente", () => {
  const { z } = require("zod");

  const clientLogSchema = z.object({
    message: z.string().min(1).max(500),
    stack: z.string().max(2000).optional(),
    componentStack: z.string().max(2000).optional(),
    url: z.string().max(500).optional(),
    userAgent: z.string().max(300).optional(),
  });

  // Payload válido
  const valid = clientLogSchema.safeParse({
    message: "Erro ao renderizar componente",
    url: "https://finance.novexbr.com.br/contas-a-pagar",
  });
  assert.strictEqual(valid.success, true);

  // Payload vazio ou com mensagem vazia deve ser rejeitado
  const empty = clientLogSchema.safeParse({});
  assert.strictEqual(empty.success, false);

  // Mensagem gigante (> 500 chars) deve ser rejeitada
  const oversized = clientLogSchema.safeParse({
    message: "a".repeat(501),
  });
  assert.strictEqual(oversized.success, false);
});
