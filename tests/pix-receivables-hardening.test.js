const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { MercadoPagoReportsClient } = require("../src/integrations/mercado-pago/reports-client.ts");
const { classifyFixedChargePayment, getPixChargeIdempotencyKey } = require("../src/domain/pix-receivable.ts");

const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/settlement-fixtures.json"), "utf8")).fixtures;
const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");

test("Fixtures — Normal Credit & Debit geram chaves compostas determinísticas", () => {
  const creditRes = client.parseSettlementReportCsv(fixtures.normalCredit.csv);
  assert.strictEqual(creditRes.validCount, 1);
  assert.strictEqual(creditRes.transactions[0].direction, "CREDIT");
  assert.strictEqual(creditRes.transactions[0].netAmountCents, 15000);
  assert.strictEqual(creditRes.transactions[0].externalId, "900100001_SETTLEMENT_CREDIT_15000");

  const debitRes = client.parseSettlementReportCsv(fixtures.normalDebit.csv);
  assert.strictEqual(debitRes.validCount, 1);
  assert.strictEqual(debitRes.transactions[0].direction, "DEBIT");
  assert.strictEqual(debitRes.transactions[0].netAmountCents, 5390);
  assert.strictEqual(debitRes.transactions[0].externalId, "900100002_SETTLEMENT_DEBIT_5390");
});

test("Fixtures — Rendimento e Imposto com mesmo SOURCE_ID não colidem", () => {
  const res = client.parseSettlementReportCsv(fixtures.yieldAndTaxSameSourceId.csv);
  assert.strictEqual(res.validCount, 2);
  assert.strictEqual(res.transactions[0].externalId, "900100003_SETTLEMENT_CREDIT_5");
  assert.strictEqual(res.transactions[0].direction, "CREDIT");
  assert.strictEqual(res.transactions[1].externalId, "900100003_SETTLEMENT_DEBIT_1");
  assert.strictEqual(res.transactions[1].direction, "DEBIT");
});

test("Fixtures — Disputa e Contestação com mesmo SOURCE_ID geram chaves distintas", () => {
  const res = client.parseSettlementReportCsv(fixtures.disputeAndSettlementSameSourceId.csv);
  assert.strictEqual(res.validCount, 2);
  assert.strictEqual(res.transactions[0].externalId, "900100004_SETTLEMENT_DEBIT_4499");
  assert.strictEqual(res.transactions[1].externalId, "900100004_DISPUTE_CREDIT_4499");
});

test("Fixtures — Overlap de relatórios idênticos gera a mesma chave (100% idempotência)", () => {
  const resA = client.parseSettlementReportCsv(fixtures.overlappingIdenticalReports.reportA);
  const resB = client.parseSettlementReportCsv(fixtures.overlappingIdenticalReports.reportB);

  assert.strictEqual(resA.transactions[0].externalId, resB.transactions[0].externalId);
  assert.strictEqual(resA.transactions[0].externalId, "900100005_SETTLEMENT_CREDIT_20000");
});

test("Fixtures — Refund, Withdrawal e Late-Arriving preservam integridade", () => {
  const refRes = client.parseSettlementReportCsv(fixtures.refund.csv);
  assert.strictEqual(refRes.transactions[0].direction, "DEBIT");
  assert.strictEqual(refRes.transactions[0].externalId, "900100006_REFUND_DEBIT_3000");

  const withRes = client.parseSettlementReportCsv(fixtures.withdrawal.csv);
  assert.strictEqual(withRes.transactions[0].direction, "DEBIT");
  assert.strictEqual(withRes.transactions[0].externalId, "900100007_WITHDRAWAL_DEBIT_50000");

  const lateRes = client.parseSettlementReportCsv(fixtures.lateArriving.csv);
  assert.strictEqual(lateRes.transactions[0].direction, "CREDIT");
  assert.strictEqual(lateRes.transactions[0].externalId, "900100008_SETTLEMENT_CREDIT_8990");
});

test("Fixtures — Linhas inválidas geram rejeição e diagnóstico detalhado", () => {
  const invRes = client.parseSettlementReportCsv(fixtures.invalidRows.csv);
  assert.strictEqual(invRes.validCount, 0);
  assert.strictEqual(invRes.rejectedCount, 3);
  assert.strictEqual(invRes.errors.length, 3);
});

test("Pix Receivables — Classificação de Pagamento Fixo (classifyFixedChargePayment)", () => {
  assert.strictEqual(classifyFixedChargePayment(10000, 10000), "PAID");
  assert.strictEqual(classifyFixedChargePayment(10000, 5000), "DIVERGENT");
  assert.strictEqual(classifyFixedChargePayment(10000, 12000), "DIVERGENT");
});

test("Pix Receivables — Idempotency Key deriva de attempt incrementado", () => {
  const key1 = getPixChargeIdempotencyKey("ws_1", "inst_1", 10000, 1);
  const key2 = getPixChargeIdempotencyKey("ws_1", "inst_1", 10000, 2);
  assert.notStrictEqual(key1, key2, "Chaves de tentativas diferentes devem ser distintas");
  assert.ok(key1.startsWith("nvx_idemp_inst_1_"));
});

test("Enrichment Safety — getPaymentDetails nunca recebe chave composta", () => {
  const txServicePath = path.join(__dirname, "../src/server/services/transactions-service.ts");
  const content = fs.readFileSync(txServicePath, "utf8");

  assert.match(
    content,
    /isNumericPaymentId/,
    "Deve validar que o ID é puramente numérico"
  );
  assert.match(
    content,
    /const rawPayment = await paymentsClient\.getPaymentDetails\(rawSourceId\);/,
    "getPaymentDetails deve ser chamado exclusivamente com rawSourceId oficial"
  );
  assert.strictEqual(
    content.includes("paymentsClient.getPaymentDetails(tx.externalId)"),
    false,
    "tx.externalId composto NUNCA deve ser enviado a getPaymentDetails"
  );
});

test("Webhook — Resolução de dataId e eventId oficial", () => {
  const webhookPath = path.join(__dirname, "../src/app/api/webhooks/mercado-pago/route.ts");
  const content = fs.readFileSync(webhookPath, "utf8");

  assert.match(
    content,
    /const bodyDataId = body\?\.data\?\.id \? String\(body\.data\.id\) : \(body\?\.id \? String\(body\.id\) : undefined\);/,
    "Deve resolver dataId de body.data.id ou body.id além de query"
  );
  assert.match(
    content,
    /const eventId = `ev_\$\{notificationId\}_\$\{dataId\}_\$\{body\.action \|\| "updated"\}`;/,
    "Deve compor eventId durável com notificationId, dataId e action"
  );
});
