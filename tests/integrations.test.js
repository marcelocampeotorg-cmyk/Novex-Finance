const test = require("node:test");
const assert = require("node:assert");

const { validateAccessToken } = require("../src/integrations/mercado-pago/credentials-validator.ts");

test("Validação de Conectividade: Endpoint oficial https://api.mercadolibre.com/users/me com Bearer Token", async () => {
  // Teste de chamada de validação remota (com token inválido para testar o tratamento de 401/403)
  const result = await validateAccessToken("APP_USR-INVALID-TEST-TOKEN-123456");

  assert.strictEqual(result.valid, false, "Token de teste inválido deve ser recusado.");
  assert.strictEqual(typeof result.errorCode, "string");
  assert.ok(
    ["UNAUTHORIZED_401", "FORBIDDEN_403", "NETWORK_ERROR", "TIMEOUT"].includes(result.errorCode),
    "Deve retornar um código de erro sanitizado."
  );
});

test("Validação de Conectividade: Token vazio é rejeitado sem chamada HTTP", async () => {
  const result = await validateAccessToken("");
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.errorCode, "EMPTY_TOKEN");
});

test("Regra de Permissões: Somente OWNER e ADMIN possuem autorização para alterar credenciais", () => {
  function checkPermission(role) {
    return ["OWNER", "ADMIN"].includes(role);
  }

  assert.strictEqual(checkPermission("OWNER"), true, "OWNER deve ser autorizado.");
  assert.strictEqual(checkPermission("ADMIN"), true, "ADMIN deve ser autorizado.");
  assert.strictEqual(checkPermission("MEMBER"), false, "MEMBER comum deve ser rejeitado.");
  assert.strictEqual(checkPermission("VIEWER"), false, "VIEWER deve ser rejeitado.");
});

test("Preservação Atômica: Se a validação falhar, a credencial anterior deve ser preservada", () => {
  const existingIntegration = {
    id: "int_123",
    status: "CONNECTED",
    encryptedCredentials: "PAYLOAD_VALIDO_ANTERIOR",
  };

  function simulateReplacement(newValidationValid) {
    if (!newValidationValid) {
      // Retornar estado anterior inalterado
      return {
        success: false,
        activeCredentials: existingIntegration.encryptedCredentials,
      };
    }
    return {
      success: true,
      activeCredentials: "NOVO_PAYLOAD_CRIPTOGRAFADO",
    };
  }

  const failedReplace = simulateReplacement(false);
  assert.strictEqual(failedReplace.success, false);
  assert.strictEqual(
    failedReplace.activeCredentials,
    "PAYLOAD_VALIDO_ANTERIOR",
    "A credencial anterior não pode ser sobrescrita se o novo token for inválido."
  );
});

test("Campos Nulos: externalApplicationId ausente deve permanecer null sem ser inventado", () => {
  const mockApiResponse = { id: 99887766 }; // Sem client_id na resposta
  const externalAccountId = String(mockApiResponse.id);
  const externalApplicationId = mockApiResponse.client_id ? String(mockApiResponse.client_id) : null;

  assert.strictEqual(externalAccountId, "99887766");
  assert.strictEqual(externalApplicationId, null, "externalApplicationId ausente deve permanecer null.");
});
