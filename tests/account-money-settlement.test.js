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

test("Account Money: TRANSACTION_TYPE e SETTLEMENT_NET_AMOUNT ausentes falham sem fallback", () => {
  const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
  const missingType = client.parseSettlementReportCsv(
    "SOURCE_ID;SETTLEMENT_NET_AMOUNT;SETTLEMENT_DATE\nTX1;10.00;2026-08-24T10:00:00Z"
  );
  assert.strictEqual(missingType.validCount, 0);
  assert.match(missingType.errors[0], /colunas obrigatórias/i);

  const missingNet = client.parseSettlementReportCsv(
    "SOURCE_ID;TRANSACTION_TYPE;TRANSACTION_AMOUNT;SETTLEMENT_DATE\nTX1;SETTLEMENT;10.00;2026-08-24T10:00:00Z"
  );
  assert.strictEqual(missingNet.validCount, 0);
  assert.match(missingNet.errors[0], /colunas obrigatórias/i);
});

test("Account Money: payload bruto do provedor e zero líquido real são preservados", () => {
  const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
  const result = client.parseSettlementReportCsv(
    "SOURCE_ID;TRANSACTION_TYPE;TRANSACTION_AMOUNT;SETTLEMENT_NET_AMOUNT;FEE_AMOUNT;SETTLEMENT_DATE;METADATA\nTX0;SETTLEMENT;10.00;0.00;10.00;2026-08-24T10:00:00Z;fee-total"
  );
  assert.strictEqual(result.transactions[0].netAmountCents, 0);
  assert.strictEqual(result.transactions[0].amountCents, 1000);
  assert.strictEqual(result.transactions[0].rawProviderData.METADATA, "fee-total");
});

test("Governança: Ausencia de /v1/payments/search no pipeline do Ledger e scripts destrutivos no repositório", () => {
  const reportsClientPath = path.join(__dirname, "../src/integrations/mercado-pago/reports-client.ts");
  const reportsContent = fs.readFileSync(reportsClientPath, "utf-8");
  assert.strictEqual(reportsContent.includes("payments/search"), false, "reports-client.ts nao deve conter payments/search");
  assert.strictEqual(reportsContent.includes("fetchAccountStatement"), false, "reports-client.ts nao deve conter fetchAccountStatement");

  const txServicePath = path.join(__dirname, "../src/server/services/transactions-service.ts");
  const txContent = fs.readFileSync(txServicePath, "utf-8");
  assert.strictEqual(txContent.includes("searchLivePayments"), false, "transactions-service.ts nao deve conter chamada para searchLivePayments");

  const scratchDir = path.join(__dirname, "../scratch");
  assert.strictEqual(fs.existsSync(scratchDir), false, "Diretorio scratch destrutivo nao deve existir no repositorio.");

  const afazerPath = path.join(__dirname, "../afazer.md");
  assert.strictEqual(fs.existsSync(afazerPath), false, "Arquivo afazer.md obsoleto nao deve existir na raiz do repositorio.");
});

test("Account Money: criação retorna task id e task pending/processed usa endpoint exato", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (options.method === "POST") return { status: 202, ok: true, json: async () => ({ id: 741, status: "pending" }) };
    if (String(url).endsWith("/task/741")) return { ok: true, status: 200, json: async () => ({ id: 741, status: "pending" }) };
    return { ok: true, status: 200, json: async () => ({ id: 741, status: "processed", report_id: 9001, file_name: "settlement-9001.csv" }) };
  };
  try {
    const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
    const created = await client.requestSettlementReport(new Date("2026-08-01T00:00:00Z"), new Date("2026-08-02T00:00:00Z"));
    assert.strictEqual(created.taskId, "741");
    assert.strictEqual((await client.getSettlementReportTask("741")).status, "PROCESSING");
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return { ok: true, status: 200, json: async () => ({ id: 741, status: "processed", report_id: 9001, file_name: "settlement-9001.csv" }) };
    };
    const ready = await client.getSettlementReportTask("741");
    assert.deepStrictEqual(ready, { taskId: "741", status: "READY", reportId: "9001", fileName: "settlement-9001.csv" });
    assert.ok(calls.some((call) => call.url.endsWith("/settlement_report/task/741")));
  } finally { global.fetch = originalFetch; }
});

test("Account Money: configuração legada é atualizada com colunas oficiais e datas sem milissegundos", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (!options.method) return { ok: true, status: 200, json: async () => ({ columns: [{ key: "RECORD_TYPE" }] }) };
    if (options.method === "PUT") return { ok: true, status: 200, json: async () => ({}) };
    return { ok: true, status: 202, json: async () => ({ id: 742, status: "pending" }) };
  };
  try {
    const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
    await client.requestSettlementReport(new Date("2026-08-01T00:00:00.123Z"), new Date("2026-08-02T23:59:59.987Z"));
    const update = calls.find((call) => call.options.method === "PUT");
    const creation = calls.find((call) => call.options.method === "POST" && call.url.endsWith("/settlement_report"));
    const configBody = JSON.parse(update.options.body);
    const creationBody = JSON.parse(creation.options.body);
    assert.ok(configBody.columns.some((column) => column.key === "TRANSACTION_TYPE"));
    assert.ok(configBody.columns.some((column) => column.key === "SETTLEMENT_NET_AMOUNT"));
    assert.strictEqual(configBody.columns.some((column) => column.key === "RECORD_TYPE"), true, "Deve preservar coluna existente RECORD_TYPE (UNION)");
    assert.deepStrictEqual(creationBody, { begin_date: "2026-08-01T00:00:00Z", end_date: "2026-08-02T23:59:59Z" });
  } finally { global.fetch = originalFetch; }
});

test("Account Money: search exige filtro e envia filtro oficial, sem catálogo global", async () => {
  const originalFetch = global.fetch;
  let requestedUrl = "";
  global.fetch = async (url) => { requestedUrl = String(url); return { ok: true, status: 200, json: async () => ({ results: [] }) }; };
  try {
    const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
    await assert.rejects(() => client.searchSettlementReports({}), /Filtro exato obrigatório/);
    await client.searchSettlementReports({ id: "9001", fileName: "settlement-9001.csv" });
    assert.match(requestedUrl, /id=9001/);
    assert.match(requestedUrl, /file_name=settlement-9001.csv/);
  } finally { global.fetch = originalFetch; }
});

test("Account Money: task available preserva task id e extrai report/file CSV da resposta real v2", async (t) => {
  t.mock.method(global, "fetch", async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      id: "report-uuid",
      status: "available",
      report: { id: "settlement_v2" },
      files: [
        { type: "json", name: "report.json" },
        { type: "csv", name: "report.csv" },
      ],
    }),
  }));
  const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
  assert.deepStrictEqual(await client.getSettlementReportTask("102939649"), {
    taskId: "102939649", status: "READY", reportId: "report-uuid", fileName: "report.csv",
  });
});

test("Account Money: parser aceita o cabeçalho oficial do relatório Dinheiro em Conta", () => {
  const csv = "EXTERNAL_REFERENCE;TRANSACTION_TYPE;SETTLEMENT_DATE;SETTLEMENT_NET_AMOUNT;TRANSACTION_AMOUNT;FEE_AMOUNT;TRANSACTION_DATE;SOURCE_ID;DESCRIPTION\nREF-1;SETTLEMENT;2026-08-26T10:00:00Z;98.00;100.00;2.00;2026-08-26T09:00:00Z;SRC-1;Venda\nREF-2;WITHDRAWAL;2026-08-26T11:00:00Z;-50.00;50.00;0.00;2026-08-26T10:30:00Z;SRC-2;Saída";
  const result = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN").parseSettlementReportCsv(csv);
  assert.strictEqual(result.validCount, 2);
  assert.deepStrictEqual(
    result.transactions.map(({ direction, amountCents, netAmountCents, occurredAt }) => ({ direction, amountCents, netAmountCents, occurredAt })),
    [
      { direction: "CREDIT", amountCents: 10000, netAmountCents: 9800, occurredAt: "2026-08-26T10:00:00.000Z" },
      { direction: "DEBIT", amountCents: 5000, netAmountCents: 5000, occurredAt: "2026-08-26T11:00:00.000Z" },
    ]
  );
});
