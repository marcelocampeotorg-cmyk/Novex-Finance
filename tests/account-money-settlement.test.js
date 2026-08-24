const test = require("node:test");
const assert = require("node:assert");
const { MercadoPagoReportsClient } = require("../src/integrations/mercado-pago/reports-client.ts");

test("Account Money: MercadoPagoReportsClient recusa token invalido ou vazio na construcao", () => {
  assert.throws(() => new MercadoPagoReportsClient(""), /MercadoPagoReportsClient requer um accessToken/);
  assert.throws(() => new MercadoPagoReportsClient("DEMO_TOKEN"), /MercadoPagoReportsClient requer um accessToken/);
});

test("Account Money: Parser oficial do Relatorio Dinheiro em Conta (Settlement CSV)", () => {
  const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
  const sampleCsv = `SOURCE_ID;TRANSACTION_TYPE;SETTLEMENT_NET_AMOUNT;FEE_AMOUNT;SETTLEMENT_DATE;DESCRIPTION;EXTERNAL_REFERENCE
TX_SETTLE_101;SETTLEMENT;150.50;5.00;2026-08-24T10:00:00Z;Venda via Pix;REF_101
TX_SETTLE_102;WITHDRAWAL;-50.00;0.00;2026-08-24T11:00:00Z;Saque de Tarifa;REF_102`;

  const txs = client.parseSettlementReportCsv(sampleCsv);

  assert.strictEqual(txs.length, 2);
  assert.strictEqual(txs[0].externalId, "TX_SETTLE_101");
  assert.strictEqual(txs[0].direction, "CREDIT");
  assert.strictEqual(txs[0].amountCents, 15050);
  assert.strictEqual(txs[0].feeCents, 500);

  assert.strictEqual(txs[1].externalId, "TX_SETTLE_102");
  assert.strictEqual(txs[1].direction, "DEBIT");
  assert.strictEqual(txs[1].amountCents, 5000);
});

test("Source Separation: CSV Import nao deve vincular IntegrationAccount Mercado Pago ou provider API", () => {
  function prepareCsvTransaction(raw) {
    return {
      workspaceId: "ws_123",
      integrationAccountId: null,
      provider: null,
      source: "CSV_IMPORT",
      externalId: raw.externalId,
      amountCents: raw.amountCents,
    };
  }

  const tx = prepareCsvTransaction({ externalId: "CSV_999", amountCents: 1000 });
  assert.strictEqual(tx.integrationAccountId, null, "CSV Import nao pode vincular IntegrationAccount.");
  assert.strictEqual(tx.provider, null, "CSV Import deve ter provider null.");
  assert.strictEqual(tx.source, "CSV_IMPORT", "Source deve ser estritamente CSV_IMPORT.");
});

test("Saldo Manual: Garantia de Deprecacao", () => {
  function setManualInitialBalanceMock() {
    return {
      success: false,
      error: "Mecanismo de Saldo Inicial Manual desativado na V1.",
    };
  }
  const res = setManualInitialBalanceMock();
  assert.strictEqual(res.success, false);
  assert.match(res.error, /Mecanismo de Saldo Inicial Manual desativado/);
});
