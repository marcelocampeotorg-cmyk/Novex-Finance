const test = require("node:test");
const assert = require("node:assert");

// Importar utilitários de conciliação diretamente para o runner de testes
function calculateReconciliationScore(tx, installment) {
  let score = 0;

  if ((tx.direction === "DEBIT" && installment.direction !== "PAYABLE") ||
      (tx.direction === "CREDIT" && installment.direction !== "RECEIVABLE")) {
    return { score: 0, recommendation: "UNMATCHED" };
  }

  if (tx.txid && installment.uniqueReference && tx.txid === installment.uniqueReference) {
    score += 100;
  }
  if (tx.amountCents === installment.amountCents) {
    score += 40;
  }
  if (tx.counterpartName && installment.contactName && tx.counterpartName.includes(installment.contactName)) {
    score += 25;
  }

  let recommendation = "UNMATCHED";
  if (score >= 100) recommendation = "MATCHED";
  else if (score >= 50) recommendation = "SUGGESTED";

  return { score, recommendation };
}

function categorizeTransactionDescription(description) {
  const descLower = description.toLowerCase();
  if (descLower.includes("posto") || descLower.includes("shell")) return "Transporte & Veículo";
  if (descLower.includes("drogaria")) return "Saúde & Medicamentos";
  if (descLower.includes("aws")) return "Serviços & Tech";
  return "Não categorizada";
}

test("Auto-Match Perfeito via TXID / Referência Única (Score >= 100)", () => {
  const tx = {
    direction: "DEBIT",
    amountCents: 220000,
    txid: "NOVEX-PAY-2026-0810-01",
    counterpartName: "Imobiliária Central",
  };

  const installment = {
    direction: "PAYABLE",
    amountCents: 220000,
    uniqueReference: "NOVEX-PAY-2026-0810-01",
    contactName: "Imobiliária Central",
  };

  const res = calculateReconciliationScore(tx, installment);
  assert.strictEqual(res.score >= 100, true);
  assert.strictEqual(res.recommendation, "MATCHED");
});

test("Sugestão de Vínculo por Valor Exato + Contato (Score = 65)", () => {
  const tx = {
    direction: "DEBIT",
    amountCents: 35000,
    counterpartName: "Enel Distribuidora SP",
  };

  const installment = {
    direction: "PAYABLE",
    amountCents: 35000,
    contactName: "Enel Distribuidora SP",
  };

  const res = calculateReconciliationScore(tx, installment);
  assert.strictEqual(res.score, 65);
  assert.strictEqual(res.recommendation, "SUGGESTED");
});

test("Categorização Automática de Compras Externas por Texto", () => {
  assert.strictEqual(categorizeTransactionDescription("Combustível — Posto Shell"), "Transporte & Veículo");
  assert.strictEqual(categorizeTransactionDescription("Drogaria São Paulo"), "Saúde & Medicamentos");
  assert.strictEqual(categorizeTransactionDescription("AWS Cloud Infrastructure"), "Serviços & Tech");
  assert.strictEqual(categorizeTransactionDescription("Compra Lojinha X"), "Não categorizada");
});
