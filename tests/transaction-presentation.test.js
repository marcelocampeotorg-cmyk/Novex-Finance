import test from "node:test";
import assert from "node:assert/strict";
import { formatTransactionDisplay } from "../src/lib/transaction-presentation.ts";

test("Apresentação de Transações: PAYOUTS não inventa que a saída foi Pix", () => {
  const result = formatTransactionDisplay({
    type: "PAYOUTS",
    description: "PAYOUTS",
    direction: "DEBIT",
    amountCents: 1000,
    rawProviderData: { POI_BANK_NAME: "BRADESCO" },
  });

  assert.equal(result.title, "Transferência ou retirada registrada");
  assert.equal(result.subtitle, "BRADESCO");
  assert.equal(result.isKnownCounterpart, true);
});

test("Apresentação de Transações: rendimento exige descrição oficial explícita", () => {
  const result = formatTransactionDisplay({
    type: "SETTLEMENT",
    description: "Rendimento do saldo",
    direction: "CREDIT",
    amountCents: 18,
    counterpartName: null,
  });

  assert.equal(result.title, "Rendimento da conta Mercado Pago");
  assert.equal(result.subtitle, "Identificado no relatório oficial");
  assert.equal(result.isKnownCounterpart, false);
});

test("Apresentação de Transações: imposto exige descrição oficial explícita", () => {
  const result = formatTransactionDisplay({
    type: "SETTLEMENT",
    description: "Retenção de imposto de renda sobre rendimento",
    direction: "DEBIT",
    amountCents: 1,
    counterpartName: null,
  });

  assert.equal(result.title, "Imposto / Retenção sobre rendimento");
  assert.equal(result.subtitle, "Identificado no relatório oficial");
  assert.equal(result.isKnownCounterpart, false);
});

test("Apresentação de Transações: Pix Recebido com banco preserva nome e contraparte", () => {
  const result = formatTransactionDisplay({
    type: "regular_payment",
    description: "Pix Recebido - NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
    direction: "CREDIT",
    amountCents: 3500,
    counterpartName: "NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
  });

  assert.equal(result.title, "Pix Recebido - NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO");
  assert.equal(result.subtitle, "NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO");
  assert.equal(result.isKnownCounterpart, true);
});

test("Apresentação de Transações: REFUND e DISPUTE são convertidos com títulos bancários", () => {
  const refund = formatTransactionDisplay({
    type: "REFUND",
    description: "REFUND",
    direction: "CREDIT",
    amountCents: 5000,
  });
  assert.equal(refund.title, "Estorno recebido");

  const dispute = formatTransactionDisplay({
    type: "DISPUTE",
    description: "DISPUTE",
    direction: "CREDIT",
    amountCents: 4499,
  });
  assert.equal(dispute.title, "Contestação de pagamento");
});

test("Apresentação de Transações: valor pequeno sem evidência não vira rendimento nem imposto", () => {
  const credit = formatTransactionDisplay({
    type: "SETTLEMENT",
    description: "SETTLEMENT",
    direction: "CREDIT",
    amountCents: 18,
  });
  const debit = formatTransactionDisplay({
    type: "SETTLEMENT",
    description: "SETTLEMENT",
    direction: "DEBIT",
    amountCents: 1,
  });

  assert.equal(credit.title, "Entrada na conta Mercado Pago");
  assert.equal(debit.title, "Saída da conta Mercado Pago");
  assert.equal(credit.subtitle, "Não informado pelo provedor");
  assert.equal(debit.subtitle, "Não informado pelo provedor");
});
