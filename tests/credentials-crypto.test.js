const test = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");

// Configurar variável de ambiente de 32 bytes em Base64 para a suíte de testes
process.env.CREDENTIALS_ENCRYPTION_KEY_BASE64 = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="; // 32 bytes: "12345678901234567890123456789012"

const {
  encryptCredentials,
  decryptCredentials,
  validateTokenLocalFormat,
  maskAccessToken,
} = require("../src/lib/server/credentials-crypto.ts");

test("AES-256-GCM: Criptografia e descriptografia bidirecional com integridade", () => {
  const token = "APP_USR-89421049210948210948210948-123456";
  const encrypted = encryptCredentials(token);

  assert.strictEqual(typeof encrypted, "string");
  const parsed = JSON.parse(encrypted);
  assert.strictEqual(parsed.version, 1);
  assert.strictEqual(parsed.algorithm, "aes-256-gcm");

  const decrypted = decryptCredentials(encrypted);
  assert.strictEqual(decrypted, token);
});

test("AES-256-GCM: Duas criptografias do mesmo texto devem usar IVs aleatórios de 12 bytes diferentes", () => {
  const token = "TEST-TOKEN-123456789";
  const enc1 = JSON.parse(encryptCredentials(token));
  const enc2 = JSON.parse(encryptCredentials(token));

  assert.notStrictEqual(enc1.iv, enc2.iv, "IVs gerados devem ser aleatórios e únicos por operação.");
  assert.strictEqual(Buffer.from(enc1.iv, "base64").length, 12, "O IV de AES-256-GCM deve possuir 12 bytes.");
  assert.strictEqual(Buffer.from(enc2.iv, "base64").length, 12, "O IV de AES-256-GCM deve possuir 12 bytes.");
});

test("AES-256-GCM: Tag de autenticação ou Ciphertext adulterados causam erro de integridade", () => {
  const token = "SECRET-TOKEN";
  const enc = JSON.parse(encryptCredentials(token));

  // Adulterar ciphertext
  enc.ciphertext = Buffer.from("DATOS_CORRUPTOS").toString("base64");
  const corruptedJson = JSON.stringify(enc);

  assert.throws(
    () => decryptCredentials(corruptedJson),
    /CRYPTO_ERROR: Falha de integridade/,
    "Deve rejeitar payloads adulterados."
  );
});

test("AES-256-GCM: Rejeição de chave de criptografia master menor ou diferente de 32 bytes", () => {
  const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY_BASE64;

  // Setar chave inválida de 16 bytes em base64
  process.env.CREDENTIALS_ENCRYPTION_KEY_BASE64 = Buffer.from("1234567890123456").toString("base64");

  assert.throws(
    () => encryptCredentials("test"),
    /CRYPTO_ERROR: Chave de criptografia inválida. Tamanho esperado: 32 bytes/,
    "Deve recusar chaves que não tenham 32 bytes exatos."
  );

  // Restaurar chave original
  process.env.CREDENTIALS_ENCRYPTION_KEY_BASE64 = originalKey;
});

test("Mascaramento de Token: Retorna apenas os 4 últimos dígitos sem expor o token", () => {
  assert.strictEqual(maskAccessToken("APP_USR-1234567890ABCDEF"), "APP_USR-••••••••••••CDEF");
  assert.strictEqual(maskAccessToken("TEST-9876543210FEDCBA"), "TEST-••••••••••••DCBA");
  assert.strictEqual(maskAccessToken("MINIMAL1234"), "••••••••••••1234");
  assert.strictEqual(maskAccessToken("12"), "••••••••••••");
});

test("Validação Local do Token: Rejeita espaços, quebras de linha e tamanhos inválidos", () => {
  assert.strictEqual(validateTokenLocalFormat("").valid, false);
  assert.strictEqual(validateTokenLocalFormat("   ").valid, false);
  assert.strictEqual(validateTokenLocalFormat("TOKEN COM ESPACO").valid, false);
  assert.strictEqual(validateTokenLocalFormat("TOKEN\nCOM\nQUEBRA").valid, false);
  assert.strictEqual(validateTokenLocalFormat("123456789").valid, false); // < 10 chars

  // Aceita tokens sem prefixo rígido (a ser validado remotamente)
  assert.strictEqual(validateTokenLocalFormat("token_sem_prefixo_padrao_valido_123").valid, true);
});
