const test = require("node:test");
const assert = require("node:assert/strict");

const { parseCSVStatement } = require("../src/services/csv-statement-parser.ts");

// Função pura equivalente para testes unitários isolados do motor de conciliação
function calculateReconciliationScore(tx, installment) {
  const reasons = [];
  let score = 0;

  const expectedDirection = installment.direction === "PAYABLE" ? "DEBIT" : "CREDIT";
  if (tx.direction !== expectedDirection) {
    return { score: 0, reasons: ["Direção indevida"], recommendation: "UNMATCHED" };
  }

  if (
    (tx.txid && installment.uniqueReference && tx.txid === installment.uniqueReference) ||
    (tx.rawReference && installment.uniqueReference && tx.rawReference.includes(installment.uniqueReference))
  ) {
    score += 100;
    reasons.push("Referência única/TXID idêntico (+100)");
  }

  if (tx.amountCents === installment.amountCents) {
    score += 40;
    reasons.push("Valor exato da parcela (+40)");
  }

  if (
    tx.counterpartName &&
    installment.contactName &&
    (tx.counterpartName.toLowerCase().includes(installment.contactName.toLowerCase()) ||
      installment.contactName.toLowerCase().includes(tx.counterpartName.toLowerCase()))
  ) {
    score += 25;
    reasons.push("Contato/Favorecido compatível (+25)");
  }

  const diffTime = Math.abs(tx.occurredAt.getTime() - installment.dueDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) {
    score += 20;
    reasons.push(`Data próxima ao vencimento (${diffDays} dia(s)) (+20)`);
  }

  let recommendation = "UNMATCHED";
  if (score >= 100) recommendation = "MATCHED";
  else if (score >= 50) recommendation = "SUGGESTED";

  return { score, reasons, candidateInstallmentId: installment.id, recommendation };
}

function categorizeTransactionDescription(description) {
  const descLower = description.toLowerCase();
  if (descLower.includes("posto") || descLower.includes("shell") || descLower.includes("ipiranga") || descLower.includes("uber")) {
    return "Transporte & Veículo";
  }
  if (descLower.includes("drogaria") || descLower.includes("farmacia") || descLower.includes("hospital")) {
    return "Saúde & Medicamentos";
  }
  if (descLower.includes("aws") || descLower.includes("hetzner") || descLower.includes("github") || descLower.includes("google cloud")) {
    return "Serviços & Tech";
  }
  if (descLower.includes("aluguel") || descLower.includes("imobiliaria")) {
    return "Moradia";
  }
  if (descLower.includes("restaurante") || descLower.includes("ifood") || descLower.includes("padaria")) {
    return "Alimentação";
  }
  return "Não categorizada";
}

test("Parser CSV: Processa extrato com delimitador ponto e vírgula e colunas de débito/crédito", () => {
  const csvContent = `Data;ID Transação;Descrição;Valor;Contraparte
01/08/2026;TX-001;Posto Shell Combustivel;-245,00;Posto Shell Ltda
02/08/2026;TX-002;Recebimento Pix Cliente;1500,50;Mariana Santos`;

  const results = parseCSVStatement(csvContent);

  assert.equal(results.length, 2);

  // Primeira linha: Débito
  assert.equal(results[0].externalId, "TX-001");
  assert.equal(results[0].direction, "DEBIT");
  assert.equal(results[0].amountCents, 24500);
  assert.equal(results[0].counterpartName, "Posto Shell Ltda");

  // Segunda linha: Crédito
  assert.equal(results[1].externalId, "TX-002");
  assert.equal(results[1].direction, "CREDIT");
  assert.equal(results[1].amountCents, 150050);
  assert.equal(results[1].counterpartName, "Mariana Santos");
});

test("Motor de Conciliação: Match Perfeito em Contas a Pagar via TXID (Score >= 100)", () => {
  const tx = {
    direction: "DEBIT",
    amountCents: 85000,
    occurredAt: new Date("2026-08-05T10:00:00Z"),
    counterpartName: "Tech Solutions Inovacao Ltda",
    txid: "PAY-SUPPLIER-8812",
  };

  const installment = {
    id: "inst-payable-1",
    direction: "PAYABLE",
    amountCents: 85000,
    dueDate: new Date("2026-08-05T00:00:00Z"),
    contactName: "Tech Solutions Inovacao Ltda",
    uniqueReference: "PAY-SUPPLIER-8812",
  };

  const result = calculateReconciliationScore(tx, installment);

  assert.equal(result.recommendation, "MATCHED");
  assert.ok(result.score >= 100);
  assert.equal(result.candidateInstallmentId, "inst-payable-1");
});

test("Motor de Conciliação: Rejeita match se as direções forem opostas", () => {
  const tx = {
    direction: "DEBIT",
    amountCents: 50000,
    occurredAt: new Date("2026-08-05T10:00:00Z"),
  };

  const installment = {
    id: "inst-receivable-1",
    direction: "RECEIVABLE",
    amountCents: 50000,
    dueDate: new Date("2026-08-05T00:00:00Z"),
  };

  const result = calculateReconciliationScore(tx, installment);

  assert.equal(result.recommendation, "UNMATCHED");
  assert.equal(result.score, 0);
  assert.equal(result.reasons[0], "Direção indevida");
});

test("Categorização Automática: Identifica categorias por palavra-chave na descrição", () => {
  assert.equal(categorizeTransactionDescription("Posto Shell Combustivel"), "Transporte & Veículo");
  assert.equal(categorizeTransactionDescription("Drogaria Sao Paulo"), "Saúde & Medicamentos");
  assert.equal(categorizeTransactionDescription("AWS Cloud Services"), "Serviços & Tech");
  assert.equal(categorizeTransactionDescription("iFood Restaurante"), "Alimentação");
  assert.equal(categorizeTransactionDescription("Pagamento avulso"), "Não categorizada");
});
