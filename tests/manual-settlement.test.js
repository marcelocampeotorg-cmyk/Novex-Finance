import test from "node:test";
import assert from "node:assert/strict";

/**
 * Simulação determinística do domínio de liquidação manual (settleInstallmentManually)
 */
function simulateManualSettlement({
  installment,
  amountCents,
  settlementDate,
  paymentMethod,
  notes,
  userId = "user-123",
}) {
  if (installment.status === "SETTLED") {
    return { success: false, error: "Esta parcela já se encontra totalmente quitada." };
  }

  const remainingCents = installment.amountCents - installment.settledAmountCents;
  if (amountCents <= 0 || amountCents > remainingCents) {
    return {
      success: false,
      error: `Valor informado (${amountCents}) inválido ou maior que o saldo restante (${remainingCents}).`,
    };
  }

  const isReceivable = installment.direction === "RECEIVABLE";
  const txDirection = isReceivable ? "CREDIT" : "DEBIT";

  const methodLabelMap = {
    CASH: "Cédula / Dinheiro em espécie",
    PIX_MANUAL: "Pix (manual / externo)",
    BANK_TRANSFER: "Transferência Bancária",
    OTHER: "Outro meio manual",
  };
  const methodLabel = methodLabelMap[paymentMethod] || "Manual";

  const descPrefix = isReceivable ? "Recebimento" : "Pagamento";
  const description = `${descPrefix} em ${methodLabel} — ${installment.title}`;

  const extTx = {
    id: "tx-manual-" + Math.random().toString(36).slice(2, 9),
    source: "MANUAL_ADJUSTMENT",
    direction: txDirection,
    type: "MANUAL_ENTRY",
    status: "APPROVED",
    amountCents,
    occurredAt: new Date(settlementDate),
    counterpartName: installment.contactName,
    description,
    rawEnrichmentData: {
      source: "MANUAL_SETTLEMENT",
      paymentMethod,
      methodLabel,
      notes,
      actorUserId: userId,
      installmentId: installment.id,
    },
  };

  const ledgerEntry = {
    id: "ledger-" + Math.random().toString(36).slice(2, 9),
    externalTransactionId: extTx.id,
    installmentId: installment.id,
    direction: txDirection,
    amountCents,
    occurredAt: new Date(settlementDate),
    sourceType: "MANUAL_ADJUSTMENT",
  };

  const reconciliation = {
    id: "rec-" + Math.random().toString(36).slice(2, 9),
    externalTransactionId: extTx.id,
    installmentId: installment.id,
    status: "MATCHED",
    score: 100,
    matchedBy: "USER",
    reasons: [`Baixa manual confirmada pelo usuário (${methodLabel})`],
  };

  const newSettledAmount = installment.settledAmountCents + amountCents;
  const isFullySettled = newSettledAmount >= installment.amountCents;
  const newStatus = isFullySettled ? "SETTLED" : "PARTIAL";

  const updatedInstallment = {
    ...installment,
    settledAmountCents: newSettledAmount,
    status: newStatus,
    settlementDate: new Date(settlementDate),
  };

  return {
    success: true,
    extTx,
    ledgerEntry,
    reconciliation,
    updatedInstallment,
    isFullySettled,
  };
}

test("Baixa manual em dinheiro de Conta a Receber: gera CREDIT na Conta Geral e quita parcela (ex: R$ 250 em cédula)", () => {
  const installment = {
    id: "inst-aposta-1",
    title: "aposta tio vilmar",
    contactName: "Tio Vilmar",
    direction: "RECEIVABLE",
    amountCents: 25000,
    settledAmountCents: 0,
    status: "SCHEDULED",
    dueDate: new Date("2026-09-02"),
  };

  const res = simulateManualSettlement({
    installment,
    amountCents: 25000,
    settlementDate: "2026-09-07",
    paymentMethod: "CASH",
    notes: "Recebido em cédula em mãos",
  });

  assert.equal(res.success, true);
  assert.equal(res.isFullySettled, true);
  assert.equal(res.updatedInstallment.status, "SETTLED");
  assert.equal(res.updatedInstallment.settledAmountCents, 25000);

  // Fato no livro-caixa / Ledger
  assert.equal(res.extTx.direction, "CREDIT");
  assert.equal(res.extTx.source, "MANUAL_ADJUSTMENT");
  assert.equal(res.extTx.amountCents, 25000);
  assert.equal(res.extTx.description, "Recebimento em Cédula / Dinheiro em espécie — aposta tio vilmar");
  assert.equal(res.ledgerEntry.direction, "CREDIT");
  assert.equal(res.ledgerEntry.installmentId, "inst-aposta-1");

  // Conciliação oficial pelo usuário
  assert.equal(res.reconciliation.status, "MATCHED");
  assert.equal(res.reconciliation.matchedBy, "USER");
  assert.equal(res.reconciliation.score, 100);
});

test("Baixa manual em dinheiro de Conta a Pagar: gera DEBIT na Conta Geral e quita parcela", () => {
  const installment = {
    id: "inst-luz-1",
    title: "Conta de Energia",
    contactName: "Enel",
    direction: "PAYABLE",
    amountCents: 12000,
    settledAmountCents: 0,
    status: "SCHEDULED",
    dueDate: new Date("2026-09-10"),
  };

  const res = simulateManualSettlement({
    installment,
    amountCents: 12000,
    settlementDate: "2026-09-07",
    paymentMethod: "CASH",
    notes: "Pago em cédula na lotérica",
  });

  assert.equal(res.success, true);
  assert.equal(res.isFullySettled, true);
  assert.equal(res.updatedInstallment.status, "SETTLED");
  assert.equal(res.extTx.direction, "DEBIT");
  assert.equal(res.ledgerEntry.direction, "DEBIT");
  assert.equal(res.extTx.description, "Pagamento em Cédula / Dinheiro em espécie — Conta de Energia");
});

test("Baixa manual parcial: se valor for menor que o total da parcela, status vira PARTIAL", () => {
  const installment = {
    id: "inst-divida-1",
    title: "Dívida Amigo",
    contactName: "Carlos",
    direction: "RECEIVABLE",
    amountCents: 30000,
    settledAmountCents: 0,
    status: "SCHEDULED",
    dueDate: new Date("2026-09-15"),
  };

  const res = simulateManualSettlement({
    installment,
    amountCents: 10000, // Pagou só 100 reais dos 300
    settlementDate: "2026-09-07",
    paymentMethod: "CASH",
  });

  assert.equal(res.success, true);
  assert.equal(res.isFullySettled, false);
  assert.equal(res.updatedInstallment.status, "PARTIAL");
  assert.equal(res.updatedInstallment.settledAmountCents, 10000);
  assert.equal(res.extTx.amountCents, 10000);
});

test("Guardrail: rejeita baixa se o valor for maior que o saldo restante da parcela", () => {
  const installment = {
    id: "inst-1",
    title: "Conta Teste",
    direction: "RECEIVABLE",
    amountCents: 20000,
    settledAmountCents: 5000,
    status: "PARTIAL",
    dueDate: new Date("2026-09-15"),
  };

  const res = simulateManualSettlement({
    installment,
    amountCents: 16000, // Restam 15000, tentou baixar 16000
    settlementDate: "2026-09-07",
    paymentMethod: "CASH",
  });

  assert.equal(res.success, false);
  assert.match(res.error, /maior que o saldo restante/);
});

test("Guardrail: rejeita baixa em parcela que já está SETTLED", () => {
  const installment = {
    id: "inst-1",
    title: "Conta Paga",
    direction: "RECEIVABLE",
    amountCents: 20000,
    settledAmountCents: 20000,
    status: "SETTLED",
    dueDate: new Date("2026-09-01"),
  };

  const res = simulateManualSettlement({
    installment,
    amountCents: 5000,
    settlementDate: "2026-09-07",
    paymentMethod: "CASH",
  });

  assert.equal(res.success, false);
  assert.match(res.error, /já se encontra totalmente quitada/);
});

test("Apresentação de transação manual: exibe contraparte e método de pagamento no subtítulo", async () => {
  const { formatTransactionDisplay } = await import("../src/lib/transaction-presentation.ts");

  const tx = {
    source: "MANUAL_ADJUSTMENT",
    direction: "CREDIT",
    amountCents: 25000,
    counterpartName: "Tio Vilmar",
    description: "Recebimento em Cédula / Dinheiro em espécie — aposta tio vilmar",
    rawEnrichmentData: {
      methodLabel: "Cédula / Dinheiro em espécie",
      paymentMethod: "CASH",
    },
  };

  const display = formatTransactionDisplay(tx);
  assert.equal(display.title, "Recebimento em Cédula / Dinheiro em espécie — aposta tio vilmar");
  assert.equal(display.subtitle, "Tio Vilmar · Cédula / Dinheiro em espécie");
  assert.equal(display.isKnownCounterpart, true);
  assert.equal(display.identificationStatus, "OFFICIAL");
});

test("Parsing de data da baixa manual: se for hoje em BRT usa horário atual, se for data retroativa ancora ao meio-dia BRT sem virar dia anterior", () => {
  function parseSettlementDate(dateStr) {
    const now = new Date();
    const todayBrt = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    if (dateStr === todayBrt) {
      return now;
    }
    const parsed = new Date(`${dateStr}T12:00:00-03:00`);
    return isNaN(parsed.getTime()) ? new Date(dateStr) : parsed;
  }

  const pastDate = parseSettlementDate("2026-09-05");
  // No fuso de Brasília, a data deve ser exatamente 05/09/2026 às 12:00
  const dateFormattedBrt = pastDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  assert.equal(dateFormattedBrt, "05/09/2026");
});

