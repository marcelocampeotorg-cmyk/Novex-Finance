const test = require("node:test");
const assert = require("node:assert/strict");

// Teste unitário para a lógica calibrada de pontuação de conciliação
function calculateReconciliationScore(tx, installment) {
  const reasons = [];
  let score = 0;

  const expectedDirection = installment.direction === "PAYABLE" ? "DEBIT" : "CREDIT";
  if (tx.direction !== expectedDirection) {
    return { score: 0, reasons: ["Direção indevida"], recommendation: "UNMATCHED" };
  }

  const isExactAmount = tx.amountCents === installment.amountCents;

  if (
    (tx.txid && installment.uniqueReference && tx.txid === installment.uniqueReference) ||
    (tx.rawReference && installment.uniqueReference && tx.rawReference.includes(installment.uniqueReference))
  ) {
    score += 100;
    reasons.push("Referência única/TXID idêntico (+100)");
  }

  if (isExactAmount) {
    score += 40;
    reasons.push("Valor exato da parcela (+40)");
  } else {
    reasons.push("Divergência de valor (exige decisão)");
  }

  if (
    tx.counterpartName &&
    installment.contactName &&
    (tx.counterpartName.toLowerCase().includes(installment.contactName.toLowerCase()) ||
      installment.contactName.toLowerCase().includes(tx.counterpartName.toLowerCase()))
  ) {
    score += 30;
    reasons.push("Contato/Favorecido compatível (+30)");
  }

  if (
    installment.title &&
    ((tx.description && (tx.description.toLowerCase().includes(installment.title.toLowerCase()) || installment.title.toLowerCase().includes(tx.description.toLowerCase()))) ||
      (tx.counterpartName && (tx.counterpartName.toLowerCase().includes(installment.title.toLowerCase()) || installment.title.toLowerCase().includes(tx.counterpartName.toLowerCase()))))
  ) {
    score += 25;
    reasons.push("Título/Serviço identificado no extrato (+25)");
  }

  const diffTime = Math.abs(tx.occurredAt.getTime() - installment.dueDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) {
    score += 20;
    reasons.push(`Data próxima ao vencimento (${diffDays} dia(s)) (+20)`);
  }

  // Hard Guard: se o valor for divergente, nunca auto-concilia
  if (!isExactAmount && score >= 100) {
    score = 75;
  }

  let recommendation = "UNMATCHED";
  if (score >= 90 && isExactAmount) {
    recommendation = "MATCHED";
  } else if (score >= 50) {
    recommendation = "SUGGESTED";
  }

  return { score, reasons, recommendation, candidateInstallmentId: installment.id };
}

test("Conciliação Pix: Auto-Match com Valor Exato + Contato + Vencimento Próximo (Score = 90)", () => {
  const tx = {
    direction: "CREDIT",
    amountCents: 15000,
    occurredAt: new Date("2026-09-02T14:30:00Z"),
    counterpartName: "Juliana Mendes",
    description: "Pix Recebido - Juliana Mendes",
  };

  const installment = {
    id: "inst-juliana-1",
    direction: "RECEIVABLE",
    amountCents: 15000,
    dueDate: new Date("2026-09-02T00:00:00Z"),
    contactName: "Juliana Mendes",
    title: "Mensalidade Consultoria",
  };

  const result = calculateReconciliationScore(tx, installment);

  assert.equal(result.score, 90);
  assert.equal(result.recommendation, "MATCHED");
  assert.equal(result.candidateInstallmentId, "inst-juliana-1");
});

test("Conciliação Pix: Valor divergente NUNCA gera MATCHED (Hard Guard)", () => {
  const tx = {
    direction: "CREDIT",
    amountCents: 14000, // Deveria ser 15000
    occurredAt: new Date("2026-09-02T14:30:00Z"),
    counterpartName: "Juliana Mendes",
    description: "Pix Recebido - Juliana Mendes",
    txid: "NOVEX-REC-JULIANA-01",
  };

  const installment = {
    id: "inst-juliana-1",
    direction: "RECEIVABLE",
    amountCents: 15000,
    dueDate: new Date("2026-09-02T00:00:00Z"),
    contactName: "Juliana Mendes",
    uniqueReference: "NOVEX-REC-JULIANA-01",
    title: "Mensalidade Consultoria",
  };

  const result = calculateReconciliationScore(tx, installment);

  assert.notEqual(result.recommendation, "MATCHED");
  assert.equal(result.recommendation, "SUGGESTED");
});

test("Parcelamento Longo: Geração e validação de 136 parcelas (ex: Pensão Alimentícia)", () => {
  const installmentsCount = 136;
  const amountPerInstallment = 859.13;
  const startDate = new Date("2026-09-10T00:00:00Z");

  const installments = [];
  for (let i = 0; i < installmentsCount; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    installments.push({
      sequence: i + 1,
      amountCents: Math.round(amountPerInstallment * 100),
      dueDate: d.toISOString().split("T")[0],
    });
  }

  assert.equal(installments.length, 136);
  assert.equal(installments[0].sequence, 1);
  assert.equal(installments[0].amountCents, 85913);
  assert.equal(installments[0].dueDate, "2026-09-10");

  assert.equal(installments[1].sequence, 2);
  assert.equal(installments[1].amountCents, 85913);
  assert.equal(installments[1].dueDate, "2026-10-10");

  assert.equal(installments[135].sequence, 136);
  assert.equal(installments[135].amountCents, 85913);

  const totalContractCents = installments.reduce((acc, curr) => acc + curr.amountCents, 0);
  assert.equal(totalContractCents, 136 * 85913);
});

test("Projeção de Recorrência no Dashboard: Projeta meses futuros sem parcela física", () => {
  const now = new Date(2026, 8, 2); // Setembro 2026 (mês 8 em JS)

  const activeRecurringExpenses = [
    {
      id: "item-pensao",
      totalAmountCents: 85913n,
      startDate: new Date("2026-09-01T00:00:00Z"),
      recurrenceRule: { active: true, endsAt: null },
    },
  ];

  const existingInstallments = [
    { id: "inst-1", financialItemId: "item-pensao", dueDate: new Date("2026-09-10T00:00:00Z"), amountCents: 85913n, settledAmountCents: 0n },
  ];

  const forecast = [];
  for (let i = 0; i < 4; i++) {
    const forecastMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);

    const pendingInMonth = existingInstallments.filter(
      (inst) => inst.dueDate >= forecastMonth && inst.dueDate < nextMonth
    );

    let totalCents = pendingInMonth.reduce((acc, inst) => acc + Number(inst.amountCents - inst.settledAmountCents), 0);
    let count = pendingInMonth.length;

    for (const rec of activeRecurringExpenses) {
      const started = new Date(rec.startDate) < nextMonth;
      const notEnded = !rec.recurrenceRule?.endsAt || new Date(rec.recurrenceRule.endsAt) >= forecastMonth;
      const ruleActive = rec.recurrenceRule ? rec.recurrenceRule.active : true;

      if (started && notEnded && ruleActive) {
        const alreadyHasInst = pendingInMonth.some((inst) => inst.financialItemId === rec.id);
        if (!alreadyHasInst) {
          totalCents += Number(rec.totalAmountCents);
          count++;
        }
      }
    }

    forecast.push({ monthIndex: i, totalCents, count });
  }

  // Todos os 4 meses devem conter os R$ 859,13 da Pensão Alimentícia!
  assert.equal(forecast[0].totalCents, 85913); // Set/26 (via installment existente)
  assert.equal(forecast[1].totalCents, 85913); // Out/26 (projetado da recorrência ativa)
  assert.equal(forecast[2].totalCents, 85913); // Nov/26 (projetado da recorrência ativa)
  assert.equal(forecast[3].totalCents, 85913); // Dez/26 (projetado da recorrência ativa)
});

test("Indexação Pensão Alimentícia: Cálculo exato com 53% do Salário Mínimo e Reajuste", () => {
  const {
    calculatePensionInstallmentCents,
    buildPensionIndexerTag,
    parsePensionIndexerTag,
    isPensionItem,
  } = require("../src/domain/pension-indexer.ts");

  // 1. Cálculo base de 53% sobre R$ 1.621,00
  const currentWageCents = 162100;
  const currentPct = 53;
  const installmentCents = calculatePensionInstallmentCents(currentWageCents, currentPct);
  assert.equal(installmentCents, 85913); // R$ 859,13

  // 2. Simulação de reajuste anual do governo para R$ 1.700,00
  const newWageCents = 170000;
  const reajustedInstallmentCents = calculatePensionInstallmentCents(newWageCents, currentPct);
  assert.equal(reajustedInstallmentCents, 90100); // R$ 901,00

  // 3. Tag de indexação e parsing
  const tag = buildPensionIndexerTag(currentPct, currentWageCents);
  assert.equal(tag, "[INDEXER:MINIMUM_WAGE;PERCENT:53;BASE_WAGE:162100]");

  const parsed = parsePensionIndexerTag(`Pensão Alimentícia Menor ${tag}`);
  assert.equal(parsed.isIndexed, true);
  assert.equal(parsed.percentage, 53);
  assert.equal(parsed.baseWageCents, 162100);

  // 4. Verificação de exclusividade
  assert.equal(isPensionItem("Pensão alimentícia"), true);
  assert.equal(isPensionItem("PENSÃO ALIMENTÍCIA"), true);
  assert.equal(isPensionItem("Aluguel Residencial"), false);
  assert.equal(isPensionItem("Internet Fibra"), false);
});
