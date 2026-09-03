import test from "node:test";
import assert from "node:assert/strict";
import { formatTransactionDisplay } from "../src/lib/transaction-presentation.ts";

test("Apresentação de Transações: PAYOUTS com banco mostra transferência bancária limpa", () => {
  const result = formatTransactionDisplay({
    type: "PAYOUTS",
    description: "PAYOUTS",
    direction: "DEBIT",
    amountCents: 1000,
    rawProviderData: { POI_BANK_NAME: "BRADESCO" },
  });

  assert.equal(result.title, "BRADESCO");
  assert.equal(result.subtitle, "Transferência para BRADESCO");
  assert.equal(result.isKnownCounterpart, true);
});

test("Apresentação de Transações: Extrato oficial mostra favorecido confirmado", () => {
  const result = formatTransactionDisplay({
    direction: "DEBIT",
    type: "PAYOUTS",
    description: "Pagamento com QR Pix FACEBOOK SERVICOS ONLINE DO BRASIL LTDA",
    counterpartName: "FACEBOOK SERVICOS ONLINE DO BRASIL LTDA",
    rawEnrichmentData: {
      accountStatement: {
        source: "MERCADO_PAGO_ACCOUNT_STATEMENT_CSV",
        transactionType: "Pagamento com QR Pix FACEBOOK SERVICOS ONLINE DO BRASIL LTDA",
      },
    },
  });

  assert.equal(result.title, "FACEBOOK SERVICOS ONLINE DO BRASIL LTDA");
  assert.equal(result.subtitle, "Pagamento com QR Pix");
  assert.equal(result.isKnownCounterpart, true);
  assert.equal(result.identificationStatus, "OFFICIAL");
});

test("Apresentação de Transações: Regra inferida por histórico gera status INFERRED e operação correta", () => {
  const result = formatTransactionDisplay({
    direction: "DEBIT",
    type: "PAYOUTS",
    description: "Transferência Pix enviada AUTO PECAS GOIANIA",
    counterpartName: "Auto Pecas Goiania",
    rawEnrichmentData: {
      source: "INFERRED",
      counterpartRule: {
        pattern: "auto pecas",
        canonicalName: "Auto Pecas Goiania",
      },
    },
  });

  assert.equal(result.title, "Auto Pecas Goiania");
  assert.equal(result.subtitle, "Transferência Pix enviada");
  assert.equal(result.isKnownCounterpart, true);
  assert.equal(result.identificationStatus, "INFERRED");
});

test("Apresentação de Transações: Saída sem qualquer evidência detecta operação por referência", () => {
  const result = formatTransactionDisplay({
    direction: "DEBIT",
    type: "PAYOUTS",
    description: "PAYOUTS",
    counterpartName: null,
    rawProviderData: { EXTERNAL_REFERENCE: "QR260902200429" },
  });

  assert.equal(result.title, "Pagamento com QR Pix");
  assert.equal(result.subtitle, "Ref: QR260902200429");
  assert.equal(result.isKnownCounterpart, false);
  assert.equal(result.identificationStatus, "UNIDENTIFIED");
});

test("Apresentação de Transações: rendimento do saldo exibe título amigável de CDI", () => {
  const result = formatTransactionDisplay({
    type: "SETTLEMENT",
    description: "Rendimento do saldo",
    direction: "CREDIT",
    amountCents: 18,
    counterpartName: null,
  });

  assert.equal(result.title, "Rendimento do saldo");
  assert.equal(result.subtitle, "Mercado Pago (CDI)");
  assert.equal(result.isKnownCounterpart, true);
});

test("Apresentação de Transações: centavos na madrugada sem descrição viram rendimento do saldo", () => {
  const result = formatTransactionDisplay({
    type: "SETTLEMENT",
    description: "",
    direction: "CREDIT",
    amountCents: 4,
    counterpartName: null,
  });

  assert.equal(result.title, "Rendimento do saldo");
  assert.equal(result.subtitle, "Mercado Pago (CDI)");
  assert.equal(result.isKnownCounterpart, true);
});

test("Apresentação de Transações: imposto sobre rendimento exibe retenção oficial", () => {
  const result = formatTransactionDisplay({
    type: "SETTLEMENT",
    description: "Retenção de imposto de renda sobre rendimento",
    direction: "DEBIT",
    amountCents: 1,
    counterpartName: null,
  });

  assert.equal(result.title, "Imposto sobre rendimento");
  assert.equal(result.subtitle, "Retenção oficial Mercado Pago");
  assert.equal(result.isKnownCounterpart, true);
});

test("Apresentação de Transações: Pix Recebido com banco indica origem de forma limpa", () => {
  const result = formatTransactionDisplay({
    type: "regular_payment",
    description: "Pix Recebido - NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
    direction: "CREDIT",
    amountCents: 3500,
    counterpartName: "NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
  });

  assert.equal(result.title, "Pix recebido");
  assert.equal(result.subtitle, "Origem: NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO");
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

test("Apresentação de Transações: centavos do relatório de conciliação são identificados como rendimento e imposto do MP", () => {
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

  assert.equal(credit.title, "Rendimento do saldo");
  assert.equal(credit.subtitle, "Mercado Pago (CDI)");
  assert.equal(debit.title, "Imposto sobre rendimento");
  assert.equal(debit.subtitle, "Retenção oficial Mercado Pago");
});
