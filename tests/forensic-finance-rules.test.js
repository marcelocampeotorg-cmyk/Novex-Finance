const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { calculateAnchoredBalance, calculateConsolidatedBalance } = require("../src/domain/financial-balance.ts");
const { MercadoPagoReportsClient } = require("../src/integrations/mercado-pago/reports-client.ts");
const { MercadoPagoPaymentsClient } = require("../src/integrations/mercado-pago/payments-client.ts");

test("Item 18.1 — monthNet nunca é rotulado ou retornado como official balance", () => {
  const res = calculateConsolidatedBalance({
    mode: "HYBRID",
    manualBalanceCents: 10000,
    mercadoPagoOfficialBalanceCents: null,
  });
  assert.strictEqual(res, null, "Saldo consolidado não pode ser fabricado a partir de monthNet");
});

test("Item 18.2 — Integração CONNECTED não implica officialBalance CONFIRMED", () => {
  const workspacePath = path.join(__dirname, "../src/server/actions/workspace.ts");
  const content = fs.readFileSync(workspacePath, "utf-8");

  assert.strictEqual(
    content.includes('mpIntegration && mpIntegration.status === "CONNECTED" ? "CONFIRMED"'),
    false,
    "Integração CONNECTED não pode forçar officialBalanceStatus = CONFIRMED"
  );
});

test("Item 18.3 — SyncRun SUCCESS não grava net movement como officialBalance", () => {
  const txServicePath = path.join(__dirname, "../src/server/services/transactions-service.ts");
  const content = fs.readFileSync(txServicePath, "utf-8");

  assert.strictEqual(
    content.includes("officialBalanceCents: BigInt(calculatedBalance)"),
    false,
    "SyncRun SUCCESS nunca deve gravar soma de transações como officialBalanceCents"
  );
});

test("Item 18.4 — Conta Mercado Pago rejeita âncora manual", () => {
  const workspacePath = path.join(__dirname, "../src/server/actions/workspace.ts");
  const content = fs.readFileSync(workspacePath, "utf-8");

  assert.match(
    content,
    /account\.type !== "MANUAL"/,
    "workspace.ts deve bloquear âncora manual para contas que não sejam MANUAL"
  );
});

test("Item 18.5 — /v1/payments/search removido e PaymentsClient sem autoridade financeira", () => {
  const paymentsClient = new MercadoPagoPaymentsClient("TEST-TOKEN-12345");
  assert.strictEqual(typeof paymentsClient.searchLivePayments, "undefined", "searchLivePayments deve ter sido removido");

  const enrichment = paymentsClient.mapPaymentToEnrichmentData({
    id: 123456,
    status: "approved",
    description: "Serviço de Teste",
    transaction_amount: 150.00,
    payer: { first_name: "Cliente", last_name: "Exemplo", identification: { number: "12345678900" } },
    point_of_interaction: { transaction_data: { transaction_id: "E2E123456" } },
  });

  assert.strictEqual(enrichment.description, "Serviço de Teste");
  assert.strictEqual(enrichment.counterpartName, "Cliente Exemplo");
  assert.strictEqual(enrichment.counterpartDocument, "12345678900");
  assert.strictEqual(enrichment.txid, "E2E123456");
  assert.strictEqual(enrichment.amountCents, undefined, "Não pode ter autoridade sobre amountCents");
  assert.strictEqual(enrichment.netAmountCents, undefined, "Não pode ter autoridade sobre netAmountCents");
  assert.strictEqual(enrichment.direction, undefined, "Não pode ter autoridade sobre direction");
  assert.strictEqual(enrichment.occurredAt, undefined, "Não pode ter autoridade sobre occurredAt");
});

test("Item 18.6 — requestSettlementReport com correspondência determinística de datas", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (url.includes("/config")) {
      return {
        ok: true,
        json: async () => ({ include_withdraw: true, columns: [{ key: "SOURCE_ID" }] }),
      };
    }
    if (url.endsWith("/settlement_report") && options.method === "POST") {
      return {
        ok: false,
        status: 400,
        json: async () => ({ message: "Max number of reports achieved" }),
      };
    }
    if (url.includes("/settlement_report/list")) {
      return {
        ok: true,
        json: async () => [
          {
            id: 99999,
            status: "processed",
            file_name: "close-report.csv",
            begin_date: "2026-08-28T01:00:00Z", // 1 hora de diferença - NÃO DEVE DAR MATCH
            end_date: "2026-08-30T00:00:00Z",
          },
          {
            id: 88888,
            status: "processed",
            file_name: "exact-report.csv",
            begin_date: "2026-08-28T00:00:00Z", // Exato
            end_date: "2026-08-30T00:00:00Z",
          },
        ],
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  try {
    const client = new MercadoPagoReportsClient("TEST-TOKEN-12345");
    const res = await client.requestSettlementReport(
      new Date("2026-08-28T00:00:00Z"),
      new Date("2026-08-30T00:00:00Z")
    );

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.fileName, "exact-report.csv", "Deve selecionar estritamente o relatório com datas idênticas");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Item 18.7 — ensureReportConfig preserva colunas adicionais existentes (UNION)", async () => {
  let putPayload = null;
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (url.includes("/config") && options.method === "PUT") {
      putPayload = JSON.parse(options.body);
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes("/config")) {
      return {
        ok: true,
        json: async () => ({
          include_withdraw: false,
          columns: [
            { key: "SOURCE_ID" },
            { key: "CUSTOM_USER_COLUMN" }, // Coluna customizada preexistente
          ],
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  try {
    const client = new MercadoPagoReportsClient("TEST-TOKEN-12345");
    await client.ensureReportConfig();

    assert.ok(putPayload, "Deve ter enviado PUT para atualizar");
    assert.strictEqual(putPayload.include_withdraw, true);
    const keys = putPayload.columns.map((c) => c.key);
    assert.ok(keys.includes("CUSTOM_USER_COLUMN"), "Deve preservar coluna customizada preexistente");
    assert.ok(keys.includes("SOURCE_ID"), "Deve conter SOURCE_ID");
    assert.ok(keys.includes("TRANSACTION_AMOUNT"), "Deve adicionar TRANSACTION_AMOUNT");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Item 18.8 — Proteção contra Overlapping do Worker Daemon", () => {
  const workerPath = path.join(__dirname, "../src/services/worker-daemon.ts");
  const content = fs.readFileSync(workerPath, "utf-8");

  assert.match(content, /private\s+static\s+isRunning\s*=\s*false/, "Deve conter trava estática isRunning no daemon");
  assert.match(content, /WORKER_BUSY_OVERLAPPING_IGNORED/, "Deve retornar status ignorado em caso de overlapping");
  assert.match(content, /finally\s*\{\s*WorkerDaemonService\.isRunning\s*=\s*false/, "Deve liberar trava no bloco finally");
});

test("Item 18.9 — Preservação de rawProviderData e separação de rawEnrichmentData", () => {
  const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  assert.match(schema, /rawEnrichmentData\s+Json\?/, "schema.prisma deve conter rawEnrichmentData");
  assert.match(schema, /rawProviderData\s+Json\?/, "schema.prisma deve manter rawProviderData");
});

test("Item 18.10 — Label de período do mês gerado dinamicamente na Home", () => {
  const pagePath = path.join(__dirname, "../src/app/(protected)/page.tsx");
  const page = fs.readFileSync(pagePath, "utf-8");

  assert.strictEqual(
    page.includes('"Entradas de 01/08 a 31/08"'),
    false,
    "Não deve conter texto estático de agosto hardcoded"
  );
  assert.match(page, /monthRangeLabel/, "Deve usar interpolação de monthRangeLabel dinâmica");
});

test("Item 18.11 — Timezone America/Sao_Paulo no docker-compose", () => {
  const composePath = path.join(__dirname, "../docker-compose.yml");
  const content = fs.readFileSync(composePath, "utf-8");

  assert.match(content, /TZ:\s*America\/Sao_Paulo/, "docker-compose deve especificar TZ: America/Sao_Paulo");
});
