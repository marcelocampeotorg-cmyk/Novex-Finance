import test from "node:test";
import assert from "node:assert/strict";
import { MercadoPagoReleaseReportsClient } from "../src/integrations/mercado-pago/release-reports-client.ts";
import { MercadoPagoReportsClient } from "../src/integrations/mercado-pago/reports-client.ts";

test("Relatório Liberações usa o BALANCE_AMOUNT oficial mais recente e nunca confunde total com saldo", () => {
  const csv = [
    "DATE;RECORD_TYPE;NET_CREDIT_AMOUNT;NET_DEBIT_AMOUNT;BALANCE_AMOUNT;DESCRIPTION",
    "2026-09-01T00:00:00Z;initial_available_balance;100.00;0;100.00;Saldo inicial",
    "2026-09-01T10:00:00Z;release;25.50;0;125.50;Entrada",
    "2026-09-01T11:00:00Z;release;0;10.25;115.25;Saída",
    "2026-09-01T12:00:00Z;available_balance;115.25;0;115.25;Fotografia intermediária",
    "2026-09-01T23:59:59Z;total;999.00;0;115.25;Total líquido não é saldo",
  ].join("\n");
  const evidence = new MercadoPagoReleaseReportsClient("APP_USR-VALID-TEST-TOKEN").parseBalance(csv);
  assert.equal(evidence.valid, true);
  assert.equal(evidence.balanceCents, 11_525);
  assert.equal(evidence.initialBalanceCents, 10_000);
  assert.equal(evidence.movementCents, 1_525);
});

test("Relatório Liberações rejeita arquivo sem BALANCE_AMOUNT em vez de publicar falso saldo", () => {
  const csv = [
    "RECORD_TYPE;NET_CREDIT_AMOUNT;NET_DEBIT_AMOUNT",
    "initial_available_balance;100.00;0",
    "release;25.00;0",
    "total;999.00;0",
  ].join("\n");
  const evidence = new MercadoPagoReleaseReportsClient("APP_USR-VALID-TEST-TOKEN").parseBalance(csv);
  assert.equal(evidence.valid, false);
  assert.equal(evidence.balanceCents, null);
  assert.match(evidence.errors.join(" "), /BALANCE_AMOUNT/i);
});

test("Dinheiro em Conta usa nomes oficiais de banco/carteira quando presentes", () => {
  const csv = [
    "SOURCE_ID;TRANSACTION_TYPE;SETTLEMENT_NET_AMOUNT;TRANSACTION_AMOUNT;FEE_AMOUNT;SETTLEMENT_DATE;DESCRIPTION;POI_BANK_NAME;ISSUER_NAME",
    "123;PIX_TRANSFER;50.00;50.00;0;2026-09-01T10:00:00Z;Pix recebido;Banco Exemplo;",
  ].join("\n");
  const parsed = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN").parseSettlementReportCsv(csv);
  assert.equal(parsed.validCount, 1);
  assert.equal(parsed.transactions[0].counterpartName, "Banco Exemplo");
});

test("Relatório Liberações reutiliza task existente da mesma janela antes de novo POST", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    assert.match(String(url), /release_report\/list$/);
    return new Response(JSON.stringify([
      {
        id: 888,
        report_id: 999,
        begin_date: "2026-09-01T03:00:00.000Z",
        end_date: "2026-09-02T02:59:59.000Z",
        generation_date: "2026-09-02T03:10:00.000Z",
        status: "processing",
      },
    ]), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const client = new MercadoPagoReleaseReportsClient("APP_USR-VALID-TEST-TOKEN");
    const existing = await client.findExistingReport(
      new Date("2026-09-01T03:00:00.000Z"),
      new Date("2026-09-02T02:59:59.000Z"),
    );
    assert.equal(calls, 1);
    assert.equal(existing?.taskId, "888");
    assert.equal(existing?.reportId, "999");
    assert.equal(existing?.status, "PROCESSING");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
