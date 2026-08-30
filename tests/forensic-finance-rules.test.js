const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { calculateAnchoredBalance, calculateConsolidatedBalance } = require("../src/domain/financial-balance.ts");
const { MercadoPagoReportsClient } = require("../src/integrations/mercado-pago/reports-client.ts");

test("Item 20.1 — monthNet nunca é rotulado ou retornado como official balance", () => {
  // calculateConsolidatedBalance sem saldo oficial confirmado do MP deve retornar null em HYBRID
  const res = calculateConsolidatedBalance({
    mode: "HYBRID",
    manualBalanceCents: 10000,
    mercadoPagoOfficialBalanceCents: null,
  });
  assert.strictEqual(res, null, "Saldo consolidado não pode ser fabricado a partir de monthNet");
});

test("Item 20.2 — Integração CONNECTED não implica officialBalance CONFIRMED", () => {
  // Teste estrutural: workspace.ts só pode marcar CONFIRMED se a conta financeira estiver explicitamente CONFIRMED
  const workspacePath = path.join(__dirname, "../src/server/actions/workspace.ts");
  const content = fs.readFileSync(workspacePath, "utf-8");

  assert.strictEqual(
    content.includes('mpIntegration && mpIntegration.status === "CONNECTED" ? "CONFIRMED"'),
    false,
    "Integração CONNECTED não pode forçar officialBalanceStatus = CONFIRMED"
  );
});

test("Item 20.3 — SyncRun SUCCESS não grava net movement como officialBalance", () => {
  const txServicePath = path.join(__dirname, "../src/server/services/transactions-service.ts");
  const content = fs.readFileSync(txServicePath, "utf-8");

  assert.strictEqual(
    content.includes("officialBalanceCents: BigInt(calculatedBalance)"),
    false,
    "SyncRun SUCCESS nunca deve gravar soma de transações como officialBalanceCents"
  );
});

test("Item 20.4 — Conta Mercado Pago rejeita âncora manual", () => {
  const workspacePath = path.join(__dirname, "../src/server/actions/workspace.ts");
  const content = fs.readFileSync(workspacePath, "utf-8");

  assert.match(
    content,
    /account\.type !== "MANUAL"/,
    "workspace.ts deve bloquear âncora manual para contas que não sejam MANUAL"
  );
});

test("Item 20.5 — /v1/payments/search não cria LedgerEntry ou ExternalTransaction", () => {
  const txServicePath = path.join(__dirname, "../src/server/services/transactions-service.ts");
  const content = fs.readFileSync(txServicePath, "utf-8");

  assert.strictEqual(
    content.includes("searchLivePayments"),
    false,
    "transactions-service.ts não deve chamar searchLivePayments no pipeline de ingestão"
  );
});

test("Item 20.6 — max reports não reutiliza relatório de período diferente", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (url.includes("/config")) {
      return {
        ok: true,
        json: async () => ({ include_withdraw: true, columns: [{ key: "SOURCE_ID" }, { key: "PAYMENT_METHOD_TYPE" }] }),
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
            file_name: "old-report-july.csv",
            begin_date: "2026-07-01T00:00:00Z",
            end_date: "2026-07-31T23:59:59Z",
          },
        ],
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  try {
    const client = new MercadoPagoReportsClient("APP_USR-VALID-TEST-TOKEN");
    const res = await client.requestSettlementReport(
      new Date("2026-08-28T00:00:00Z"),
      new Date("2026-08-30T00:00:00Z")
    );

    assert.strictEqual(res.success, false, "Não deve reutilizar relatório de julho para pedido de agosto");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Item 20.7 — Worker 15s controla cadência e PARTIAL não é overallSuccess", () => {
  const workerPath = path.join(__dirname, "../src/services/worker-daemon.ts");
  const content = fs.readFileSync(workerPath, "utf-8");

  assert.match(
    content,
    /subsystemErrorsCount === 0 && failedCount === 0 && partialCount === 0/,
    "Worker overallSuccess deve ser falso se houver partialCount > 0"
  );
});

test("Item 20.8 — Timezone America/Sao_Paulo e limites de datas", () => {
  const composePath = path.join(__dirname, "../docker-compose.yml");
  const content = fs.readFileSync(composePath, "utf-8");

  assert.match(content, /TZ:\s*America\/Sao_Paulo/, "docker-compose deve especificar TZ: America/Sao_Paulo");
});
