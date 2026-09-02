const test = require("node:test");
const assert = require("node:assert");

// Testes unitários para utilitários de formatação financeira
test("Formatação de moeda BRL (Centavos para R$)", () => {
  const value = 1485050; // R$ 14.850,50
  const formatted = (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  assert.strictEqual(formatted.includes("14.850,50"), true);
});

test("Cálculo de Saldo Projetado", () => {
  const current = 1485050;
  const payables = 425000;
  const receivables = 1072000;
  const projected = current + receivables - payables;
  assert.strictEqual(projected, 2132050);
});

test("Formatadores defensivos contra nulo, indefinido e dados corrompidos", async () => {
  const { formatCurrency, formatDate, formatDateTime } = await import("../src/lib/formatters.ts");

  // formatCurrency nunca lanca excecao
  assert.strictEqual(formatCurrency(null), "R$ 0,00");
  assert.strictEqual(formatCurrency(undefined), "R$ 0,00");
  assert.strictEqual(formatCurrency(NaN), "R$ 0,00");
  assert.strictEqual(formatCurrency(15000).includes("150,00"), true);

  // formatDate nunca lanca excecao
  assert.strictEqual(formatDate(null), "");
  assert.strictEqual(formatDate(undefined), "");
  assert.strictEqual(formatDate(""), "");
  assert.strictEqual(formatDate("invalid-date-string"), "");
  assert.strictEqual(formatDate("2026-09-02T12:00:00Z").includes("02/09/2026"), true);

  // formatDateTime nunca lanca excecao
  assert.strictEqual(formatDateTime(null), "");
  assert.strictEqual(formatDateTime(undefined), "");
  assert.strictEqual(formatDateTime("invalid-date-string"), "");
  assert.strictEqual(formatDateTime("2026-09-02T12:00:00Z").includes("02/09/2026"), true);
});

