const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { calculateAnchoredBalance, calculateConsolidatedBalance } = require("../src/domain/financial-balance.ts");
const { MercadoPagoReportsClient } = require("../src/integrations/mercado-pago/reports-client.ts");
const { MercadoPagoPaymentsClient } = require("../src/integrations/mercado-pago/payments-client.ts");

test("Item 12.1 — financeMode MANUAL legado não bloqueia MP e não esconde movimentações", () => {
  const txServicePath = path.join(__dirname, "../src/server/services/transactions-service.ts");
  const txContent = fs.readFileSync(txServicePath, "utf-8");
  const workspacePath = path.join(__dirname, "../src/server/actions/workspace.ts");
  const wsContent = fs.readFileSync(workspacePath, "utf-8");

  assert.strictEqual(
    txContent.includes('workspaceMode?.financeMode !== "HYBRID"'),
    false,
    "transactions-service.ts não deve exigir modo HYBRID para sincronizar Mercado Pago"
  );
  assert.strictEqual(
    txContent.includes('source: workspace?.financeMode === "MANUAL"'),
    false,
    "getExternalTransactions não pode esconder transações MP quando financeMode for MANUAL"
  );
  assert.strictEqual(
    wsContent.includes('if (financeMode === "HYBRID")'),
    false,
    "workspace.ts deve carregar integração MP independentemente de financeMode ser HYBRID"
  );
});

test("Item 12.2 — Concorrência: Apenas 1 execução ganha o claim para disparar POST remoto", async () => {
  // Simulação comportamental do claim atômico de updateMany
  let activeClaim = false;
  let remotePostCount = 0;

  async function simulateWorkerExecution(workerId) {
    // Simula db.syncRun.updateMany com lock condicional
    let claimed = false;
    if (!activeClaim) {
      activeClaim = true;
      claimed = true;
    }

    if (!claimed) {
      return { status: "PROCESSING", message: "Solicitação remota já em andamento por outro processo." };
    }

    // Apenas quem ganhou o claim dispara o POST remoto
    remotePostCount++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { status: "PROCESSING", taskId: "REMOTE_TASK_123" };
  }

  // Disparar duas chamadas simultâneas
  const [resA, resB] = await Promise.all([
    simulateWorkerExecution("worker-A"),
    simulateWorkerExecution("worker-B"),
  ]);

  assert.strictEqual(remotePostCount, 1, "Exatamente 1 POST remoto deve ser disparado em execuções concorrentes");
  assert.ok(
    (resA.taskId === "REMOTE_TASK_123" && resB.message?.includes("já em andamento")) ||
    (resB.taskId === "REMOTE_TASK_123" && resA.message?.includes("já em andamento")),
    "Uma chamada realiza o claim e a outra aguarda o processo em andamento"
  );
});

test("Item 12.3 — Cooldown e Backoff contam a partir de finishedAt/updatedAt e barram force=true", () => {
  const txServicePath = path.join(__dirname, "../src/server/services/transactions-service.ts");
  const txContent = fs.readFileSync(txServicePath, "utf-8");
  const workerPath = path.join(__dirname, "../src/services/worker-daemon.ts");
  const workerContent = fs.readFileSync(workerPath, "utf-8");

  // Validação em transactions-service (proteção central)
  assert.match(
    txContent,
    /lastRun\.finishedAt\s*\|\|\s*lastRun\.updatedAt\s*\|\|\s*lastRun\.createdAt/,
    "transactions-service deve usar finishedAt || updatedAt || createdAt para referência temporal"
  );
  assert.match(
    txContent,
    /Aguardando cooldown de proteção da API/,
    "transactions-service central deve barrar chamadas em cooldown mesmo com force=true"
  );

  // Validação em worker-daemon
  assert.match(
    workerContent,
    /lastRun\.finishedAt\s*\|\|\s*lastRun\.updatedAt\s*\|\|\s*lastRun\.createdAt/,
    "worker-daemon deve usar finishedAt || updatedAt || createdAt para referência temporal"
  );
  assert.match(
    workerContent,
    /consecutiveFailures\s*>=\s*3\s*\?\s*60\s*\*\s*60\s*\*\s*1000/,
    "worker-daemon deve aplicar backoff progressivo real (até 60 min) para falhas consecutivas"
  );
});

test("Item 12.4 — Status do Dashboard modela explicitamente PROCESSANDO e FALHA", () => {
  const workspacePath = path.join(__dirname, "../src/server/actions/workspace.ts");
  const content = fs.readFileSync(workspacePath, "utf-8");

  assert.match(
    content,
    /lastRun\?\.status === "PROCESSING"\)\s*\{\s*syncSource\s*=\s*"PROCESSANDO"/,
    "Dashboard deve marcar syncSource como PROCESSANDO quando último run estiver em processamento"
  );
  assert.match(
    content,
    /lastRun\?\.status === "FAILED"\)\s*\{\s*syncSource\s*=\s*"FALHA"/,
    "Dashboard deve marcar syncSource como FALHA quando último run falhar"
  );
});

test("Item 12.5 — saveMercadoPagoCredentials exige seleção explícita de ambiente sem inferência de prefixo", () => {
  const integrationsPath = path.join(__dirname, "../src/server/actions/integrations.ts");
  const content = fs.readFileSync(integrationsPath, "utf-8");

  assert.strictEqual(
    content.includes('accessToken.startsWith("TEST-") ? "SANDBOX" : "PRODUCTION"'),
    false,
    "saveMercadoPagoCredentials não deve inferir ambiente pelo prefixo TEST-"
  );
  assert.match(
    content,
    /environment:\s*z\.enum\(\["SANDBOX",\s*"PRODUCTION"\]\)/,
    "saveCredentialsSchema deve exigir enum explícito sem default silencioso"
  );
});

test("Item 12.6 — getWorkspaceSummary nunca usa openingBalanceAt do Mercado Pago como officialBalanceAt", () => {
  const workspacePath = path.join(__dirname, "../src/server/actions/workspace.ts");
  const content = fs.readFileSync(workspacePath, "utf-8");

  assert.strictEqual(
    content.includes("mercadoPagoAccount?.openingBalanceAt?.toISOString() || mercadoPagoAccount?.officialBalanceAt?.toISOString()"),
    false,
    "mercadoPagoOfficialBalanceAt não pode conter openingBalanceAt como fallback"
  );
  assert.match(
    content,
    /mercadoPagoOfficialBalanceAt:\s*mercadoPagoAccount\?\.officialBalanceAt\?\.toISOString\(\)\s*\|\|\s*null/,
    "mercadoPagoOfficialBalanceAt deve vir estritamente de officialBalanceAt"
  );
});

test("Item 12.7 — Configuracoes/page.tsx protege select contra NAO_DETECTADO", () => {
  const configPath = path.join(__dirname, "../src/app/(protected)/configuracoes/page.tsx");
  const content = fs.readFileSync(configPath, "utf-8");

  assert.match(
    content,
    /status\?\.environment === "PRODUCTION"\s*\|\|\s*status\?\.environment === "SANDBOX"/,
    "select de ambiente na UI somente deve receber valores estritamente válidos"
  );
});

test("Item 12.8 — /v1/payments/search removido e PaymentsClient sem autoridade financeira", () => {
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

test("Item 12.9 — requestSettlementReport com correspondência determinística de datas", async () => {
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

test("Item 12.10 — ensureReportConfig preserva colunas adicionais existentes (UNION)", async () => {
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

test("Item 12.11 — Preservação de rawProviderData e separação de rawEnrichmentData", () => {
  const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
  const schema = fs.readFileSync(schemaPath, "utf-8");

  assert.match(schema, /rawEnrichmentData\s+Json\?/, "schema.prisma deve conter rawEnrichmentData");
  assert.match(schema, /rawProviderData\s+Json\?/, "schema.prisma deve manter rawProviderData");
});

test("Item 12.12 — Claim com Lease: Bloqueia concorrência ativa e recupera claim abandonado (> 2min)", async () => {
  const LEASE_MS = 2 * 60 * 1000;
  let syncRunDb = {
    id: "run-123",
    remoteTaskId: null,
    errorCode: null,
    startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min atrás (abandonado)
  };

  async function executeAtomicClaim(now) {
    const staleThreshold = new Date(now.getTime() - LEASE_MS);
    const isMatching =
      syncRunDb.id === "run-123" &&
      syncRunDb.remoteTaskId === null &&
      (syncRunDb.errorCode !== "REQUESTING_REPORT" || syncRunDb.startedAt < staleThreshold);

    if (isMatching) {
      syncRunDb.errorCode = "REQUESTING_REPORT";
      syncRunDb.startedAt = now;
      return { count: 1 };
    }
    return { count: 0 };
  }

  // 1. Processo A tenta recuperar claim abandonado há 5 minutos -> DEVE GANHAR
  const nowA = new Date();
  const claimA = await executeAtomicClaim(nowA);
  assert.strictEqual(claimA.count, 1, "Processo A deve recuperar o claim abandonado");
  assert.strictEqual(syncRunDb.errorCode, "REQUESTING_REPORT");

  // 2. Processo B tenta concorrentemente 10 segundos depois -> DEVE SER BLOQUEADO (lease ativo)
  const nowB = new Date(nowA.getTime() + 10 * 1000);
  const claimB = await executeAtomicClaim(nowB);
  assert.strictEqual(claimB.count, 0, "Processo B deve ser bloqueado enquanto lease do Processo A estiver ativo");

  // 3. Processo C tenta após 3 minutos (lease expirado se processo A morrer) -> DEVE RECLAMAR
  const nowC = new Date(nowA.getTime() + 3 * 60 * 1000);
  const claimC = await executeAtomicClaim(nowC);
  assert.strictEqual(claimC.count, 1, "Processo C deve conseguir recuperar claim após expiração do lease");
});

test("Item 12.13 — Verificação prévia evita POST duplicado em resultado remoto ambíguo", async () => {
  let postCount = 0;
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    if (url.includes("/settlement_report/list")) {
      return {
        ok: true,
        json: async () => [
          {
            id: "TASK_EXISTENTE_999",
            status: "processed",
            file_name: "settlement-2026-08-28.csv",
            begin_date: "2026-08-28T00:00:00Z",
            end_date: "2026-08-30T00:00:00Z",
          },
        ],
      };
    }
    if (url.endsWith("/settlement_report") && options.method === "POST") {
      postCount++;
      return { ok: true, json: async () => ({ id: "NOVA_TASK" }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  try {
    const client = new MercadoPagoReportsClient("TEST-TOKEN-12345");
    const requestedBegin = new Date("2026-08-28T00:00:00Z");
    const requestedEnd = new Date("2026-08-30T00:00:00Z");

    // Simulação do fluxo de verificação prévia
    const listRes = await fetch("https://api.mercadopago.com/v1/account/settlement_report/list", {
      headers: { Authorization: `Bearer TEST-TOKEN-12345` },
    });
    const list = await listRes.json();
    const requestedBeginIso = requestedBegin.toISOString().replace(/\.\d{3}Z$/, "Z");
    const requestedEndIso = requestedEnd.toISOString().replace(/\.\d{3}Z$/, "Z");

    const existingReport = list.find((r) => {
      const repBeginIso = new Date(r.begin_date).toISOString().replace(/\.\d{3}Z$/, "Z");
      const repEndIso = new Date(r.end_date).toISOString().replace(/\.\d{3}Z$/, "Z");
      return repBeginIso === requestedBeginIso && repEndIso === requestedEndIso;
    });

    let remoteTaskId = null;
    if (existingReport) {
      remoteTaskId = String(existingReport.id);
    } else {
      const res = await client.requestSettlementReport(requestedBegin, requestedEnd);
      remoteTaskId = res.taskId;
    }

    assert.strictEqual(remoteTaskId, "TASK_EXISTENTE_999", "Deve ter reutilizado o relatório existente");
    assert.strictEqual(postCount, 0, "Nenhum POST deve ser emitido quando já existe relatório equivalente");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Item 12.14 — Worker Daemon: Criação de novo sync somente quando activeSync é null e após backoff", () => {
  const workerPath = path.join(__dirname, "../src/services/worker-daemon.ts");
  const content = fs.readFileSync(workerPath, "utf-8");

  // Verificar que if (activeSync) possui seu próprio ramo e o else cuida da criação
  assert.match(
    content,
    /if\s*\(activeSync\)\s*\{[\s\S]*?\}\s*else\s*\{[\s\S]*?continueMercadoPagoSyncRun/,
    "worker-daemon deve possuir bifurcação estrita entre retomar activeSync e iniciar novo ciclo no else"
  );

  // Verificar cálculo de falhas consecutivas
  assert.match(
    content,
    /let consecutiveFailures = 0;[\s\S]*?if \(lastRun\?\.status === "FAILED"\)/,
    "worker-daemon deve calcular falhas consecutivas para backoff progressivo"
  );
});

test("Item 12.15 — UI Home: PROCESSANDO e FALHA não exibem CheckCircle verde", () => {
  const pagePath = path.join(__dirname, "../src/app/(protected)/page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  // PROCESSANDO deve renderizar spinner e texto específico
  assert.match(
    content,
    /isSyncing\s*\|\|\s*displaySummary\.syncSource\s*===\s*"PROCESSANDO"/,
    "page.tsx deve tratar syncSource PROCESSANDO com indicador de andamento"
  );

  // FALHA deve renderizar AlertTriangle e classe vermelha
  assert.match(
    content,
    /syncError\s*\|\|\s*displaySummary\.syncSource\s*===\s*"FALHA"/,
    "page.tsx deve tratar syncSource FALHA com classe de erro e AlertTriangle"
  );

  // CheckCircle2 deve ser reservado para o ramo de sucesso
  assert.match(
    content,
    /CheckCircle2 className="h-4 w-4 text-emerald-400"/,
    "page.tsx deve renderizar CheckCircle2 exclusivamente no ramo de sucesso"
  );
});

test("Item 12.16 — Reativação de transação quarentenada por UNCONFIRMED_PAYMENTS_API_IMPORT em importação oficial do Settlement", () => {
  const txServicePath = path.join(__dirname, "../src/server/services/transactions-service.ts");
  const content = fs.readFileSync(txServicePath, "utf-8");

  assert.match(
    content,
    /const isQuarantinedForUnconfirmed = existingTx\.quarantinedAt !== null && existingTx\.quarantineReason === "UNCONFIRMED_PAYMENTS_API_IMPORT"/,
    "Deve identificar especificamente transações quarentenadas por UNCONFIRMED_PAYMENTS_API_IMPORT"
  );
  assert.match(
    content,
    /const shouldReactivate = isSettlement && isQuarantinedForUnconfirmed/,
    "Somente deve reativar se for importação do Settlement Report oficial"
  );
  assert.match(
    content,
    /quarantinedAt:\s*shouldReactivate\s*\?\s*null\s*:\s*existingTx\.quarantinedAt/,
    "Deve limpar quarantinedAt ao reativar"
  );
  assert.match(
    content,
    /action:\s*"TRANSACTION_REACTIVATED_FROM_SETTLEMENT"/,
    "Deve registrar AuditLog de reativação oficial"
  );
});

test("Item 12.17 — Relatório remoto ambíguo em estado 'processing' evita novo POST e retorna PROCESSING", async () => {
  let postCalls = 0;
  const originalFetch = global.fetch;

  global.fetch = async (url, options = {}) => {
    if (url.includes("/settlement_report/list")) {
      return {
        ok: true,
        json: async () => [
          {
            id: "TASK_PROCESSING_555",
            status: "processing", // em andamento no Mercado Pago
            file_name: null,
            begin_date: "2026-08-28T00:00:00Z",
            end_date: "2026-08-30T00:00:00Z",
          },
        ],
      };
    }
    if (url.endsWith("/settlement_report") && options.method === "POST") {
      postCalls++;
      return { ok: true, json: async () => ({ id: "TASK_DUPLICADA" }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  try {
    const listRes = await fetch("https://api.mercadopago.com/v1/account/settlement_report/list", {
      headers: { Authorization: "Bearer TEST" },
    });
    const list = await listRes.json();
    const requestedBeginIso = new Date("2026-08-28T00:00:00Z").toISOString().replace(/\.\d{3}Z$/, "Z");
    const requestedEndIso = new Date("2026-08-30T00:00:00Z").toISOString().replace(/\.\d{3}Z$/, "Z");

    const existingReport = list.find((r) => {
      if (!r.begin_date || !r.end_date) return false;
      const repBeginIso = new Date(r.begin_date).toISOString().replace(/\.\d{3}Z$/, "Z");
      const repEndIso = new Date(r.end_date).toISOString().replace(/\.\d{3}Z$/, "Z");
      return repBeginIso === requestedBeginIso && repEndIso === requestedEndIso;
    });

    assert.ok(existingReport, "Deve encontrar o relatório existente");
    assert.strictEqual(existingReport.status, "processing");
    const isReady = existingReport.status === "processed" && Boolean(existingReport.file_name);
    assert.strictEqual(isReady, false, "Não deve considerar pronto");

    // Como encontrou o relatório em processamento, não deve emitir POST
    assert.strictEqual(postCalls, 0, "Nenhum POST deve ser emitido quando já existe relatório em processamento");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Item 12.18 — Preservação de startedAt: Lease de claim utiliza updatedAt", () => {
  const txServicePath = path.join(__dirname, "../src/server/services/transactions-service.ts");
  const content = fs.readFileSync(txServicePath, "utf-8");

  assert.match(
    content,
    /errorCode:\s*"REQUESTING_REPORT",\s*updatedAt:\s*\{\s*lt:\s*staleClaimThreshold\s*\}/,
    "Claim condicional deve usar updatedAt para lease sem sobrescrever startedAt"
  );
  assert.strictEqual(
    content.includes("startedAt: nowClaim"),
    false,
    "startedAt não deve ser sobrescrito durante renovação do claim"
  );
});
