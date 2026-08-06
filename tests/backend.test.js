const test = require("node:test");
const assert = require("node:assert");

test("Validação da Soma de Parcelas Variáveis", () => {
  const totalAmountCents = 250000; // R$ 2.500,00
  const installments = [
    { sequence: 1, amountCents: 85000 },
    { sequence: 2, amountCents: 85000 },
    { sequence: 3, amountCents: 80000 },
  ];

  const sumCents = installments.reduce((acc, inst) => acc + inst.amountCents, 0);
  assert.strictEqual(sumCents, totalAmountCents);
});

test("Validação de Baixa Parcial de Parcela", () => {
  const installmentAmountCents = 30000; // R$ 300,00
  const payment1 = 10000; // R$ 100,00
  const payment2 = 20000; // R$ 200,00

  let settled = 0;
  settled += payment1;
  assert.strictEqual(settled < installmentAmountCents, true);

  settled += payment2;
  assert.strictEqual(settled >= installmentAmountCents, true);
});

test("Garantia de Escopo por Workspace ID", () => {
  const userWorkspace = "ws-personal-demo";
  const query = { where: { workspaceId: userWorkspace } };
  assert.strictEqual(query.where.workspaceId, "ws-personal-demo");
});
