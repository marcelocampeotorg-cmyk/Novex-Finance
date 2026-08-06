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
