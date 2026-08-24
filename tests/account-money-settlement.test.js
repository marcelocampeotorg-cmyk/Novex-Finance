const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { MercadoPagoReportsClient, parseCsvRows } = require("../src/integrations/mercado-pago/reports-client.ts");

test("Account Money: MercadoPagoReportsClient recusa token invalido ou vazio na construcao", () => {
  assert.throws(() => new MercadoPagoReportsClient(""), /MercadoPagoReportsClient requer um accessToken/);
  assert.throws(() => new MercadoPagoReportsClient("DEMO_TOKEN"), /MercadoPagoReportsClient requer um accessToken/);
});

test("Account Money: Parser RFC 4180 lida com aspas, delimitadores entre aspas, BOM e CRLF", () => {
  const sampleCsvWithQuotes = `\uFEFFSOURCE_ID;TRANSACTION_TYPE;SETTLEMENT_NET_AMOUNT;FEE_AMOUNT;SETTLEMENT_DATE;DESCRIPTION;EXTERNAL_REFERENCE\r\nTX_SETTLE_201;SETTLEMENT;"150,50";"5,00";2026-08-24T10:00:00Z;"Venda via Pix, com vírgula e ; ponto-e-vírgula";REF_201\r\nTX_SETTLE_202;WITHDRAWAL;"-50,00";"0,00";2026-08-24T11:00:00Z;"Saque ""especial"" com aspas";REF_202`;

  const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
  const result = client.parseSettlementReportCsv(sampleCsvWithQuotes);

  assert.strictEqual(result.validCount, 2);
  assert.strictEqual(result.rejectedCount, 0);
  assert.strictEqual(result.transactions[0].externalId, "TX_SETTLE_201");
  assert.strictEqual(result.transactions[0].description, "Venda via Pix, com vírgula e ; ponto-e-vírgula");
  assert.strictEqual(result.transactions[0].amountCents, 15050);
  assert.strictEqual(result.transactions[0].feeCents, 500);

  assert.strictEqual(result.transactions[1].externalId, "TX_SETTLE_202");
  assert.strictEqual(result.transactions[1].description, 'Saque "especial" com aspas');
  assert.strictEqual(result.transactions[1].direction, "DEBIT");
  assert.strictEqual(result.transactions[1].netAmountCents, 5000);
});

test("Account Money: Linhas com valores monetarios invalidos ou datas ausentes geram diagnostico de rejeicao", () => {
  const invalidCsv = `SOURCE_ID;TRANSACTION_TYPE;SETTLEMENT_NET_AMOUNT;FEE_AMOUNT;SETTLEMENT_DATE;DESCRIPTION\r\nTX_OK;SETTLEMENT;100.00;2.00;2026-08-24T10:00:00Z;Valida\r\nTX_BAD_VAL;SETTLEMENT;INVALIDO_123;2.00;2026-08-24T10:00:00Z;Invalida Valor\r\n;SETTLEMENT;50.00;0.00;2026-08-24T10:00:00Z;Sem ID\r\nTX_BAD_DATE;SETTLEMENT;50.00;0.00;DATA_INVALIDA;Sem Data`;

  const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
  const result = client.parseSettlementReportCsv(invalidCsv);

  assert.strictEqual(result.validCount, 1);
  assert.strictEqual(result.rejectedCount, 3);
  assert.strictEqual(result.errors.length, 3);
  assert.match(result.errors[0], /rejeitada por formato numérico/i);
  assert.match(result.errors[1], /rejeitada por ausência de SOURCE_ID/i);
  assert.match(result.errors[2], /rejeitada por data de liquidação inválida/i);
});

test("Account Money: Preservacao distinta de amountCents (nominal) vs netAmountCents (liquido)", () => {
  const csvWithFeeAndAmount = `SOURCE_ID;TRANSACTION_TYPE;TRANSACTION_AMOUNT;SETTLEMENT_NET_AMOUNT;FEE_AMOUNT;SETTLEMENT_DATE;DESCRIPTION\r\nTX_DIFF;SETTLEMENT;200.00;190.00;10.00;2026-08-24T12:00:00Z;Venda com taxa`;

  const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
  const result = client.parseSettlementReportCsv(csvWithFeeAndAmount);

  assert.strictEqual(result.validCount, 1);
  assert.strictEqual(result.transactions[0].amountCents, 20000, "amountCents deve conter o valor nominal (200.00)");
  assert.strictEqual(result.transactions[0].netAmountCents, 19000, "netAmountCents deve conter o valor liquido (190.00)");
  assert.strictEqual(result.transactions[0].feeCents, 1000, "feeCents deve conter a tarifa (10.00)");
});

test("Governança: Ausencia de /v1/payments/search e scripts destrutivos no repositório", () => {
  const reportsClientPath = path.join(__dirname, "../src/integrations/mercado-pago/reports-client.ts");
  const content = fs.readFileSync(reportsClientPath, "utf-8");

  assert.strictEqual(content.includes("payments/search"), false, "reports-client.ts nao deve conter payments/search");
  assert.strictEqual(content.includes("fetchAccountStatement"), false, "reports-client.ts nao deve conter fetchAccountStatement");

  const scratchDir = path.join(__dirname, "../scratch");
  assert.strictEqual(fs.existsSync(scratchDir), false, "Diretorio scratch destrutivo nao deve existir no repositorio.");

  const afazerPath = path.join(__dirname, "../afazer.md");
  assert.strictEqual(fs.existsSync(afazerPath), false, "Arquivo afazer.md obsoleto nao deve existir na raiz do repositorio.");
});
