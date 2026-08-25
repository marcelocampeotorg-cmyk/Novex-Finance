const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Hardening: migrations forward-only cobrem drift e concorrência", () => {
  const sql = read("prisma/migrations/20260824000003_audit_hardening/migration.sql");
  for (const expected of ["raw_provider_data", "dedupe_key", "sync_runs_one_processing_per_account", "payment_intentions_one_waiting_per_installment"]) {
    assert.ok(sql.includes(expected), `migration deve conter ${expected}`);
  }
});

test("Hardening: runtime não contém segredo Evolution, cobrança teste falsa ou ledger Pix provisório", () => {
  const evolution = read("src/integrations/evolution-api/client.ts");
  const config = read("src/app/(protected)/configuracoes/page.tsx");
  const webhook = read("src/app/api/webhooks/mercado-pago/route.ts");
  const pix = read("src/server/actions/pix-receivables.ts");
  assert.ok(!evolution.includes("42960010999"));
  assert.ok(!config.includes("Cliente Teste"));
  assert.ok(!config.includes("pix.teste"));
  assert.ok(!webhook.includes('sourceType: "MERCADO_PAGO_PIX"'));
  assert.ok(!pix.includes('sourceType: "MERCADO_PAGO_PIX"'));
});

test("PWA: service worker limita cache a assets públicos estáticos", () => {
  const sw = read("public/sw.js");
  assert.ok(sw.includes('event.request.mode === "navigate"'));
  assert.ok(sw.includes('url.pathname.startsWith("/api/")'));
  assert.ok(!sw.includes('caches.match("/")'));
  assert.ok(fs.existsSync(path.join(__dirname, "../public/brand/novex_symbol_original.png")));
});

test("PWA: registro existe e PNGs do manifest têm dimensões reais", () => {
  const registration = read("src/components/pwa/ServiceWorkerRegistration.tsx");
  assert.ok(registration.includes('navigator.serviceWorker.register("/sw.js")'));
  for (const [file, expected] of [["novex-icon-192.png", 192], ["novex-icon-512.png", 512]]) {
    const bytes = fs.readFileSync(path.join(__dirname, "../public/brand", file));
    assert.strictEqual(bytes.readUInt32BE(16), expected);
    assert.strictEqual(bytes.readUInt32BE(20), expected);
  }
});

test("Segurança: ações públicas não aceitam contexto interno ou workspace arbitrário", () => {
  for (const file of ["transactions.ts", "reconciliation.ts", "notifications.ts", "recurrence.ts"]) {
    const action = read(`src/server/actions/${file}`);
    assert.ok(!action.includes("INTERNAL_WORKER_CONTEXT"));
    assert.ok(!action.includes("targetWorkspaceId"));
    assert.ok(!action.includes("integrationAccountId"));
    assert.ok(!action.includes("syncRunId"));
  }
  const integrations = read("src/server/actions/integrations.ts");
  assert.ok(!integrations.includes("getActiveMercadoPagoIntegration(workspaceId"));
  const publicResolver = integrations.slice(
    integrations.indexOf("export async function getActiveMercadoPagoIntegration()"),
    integrations.indexOf("export async function getMercadoPagoIntegrationStatus()")
  );
  assert.ok(!publicResolver.includes("encryptedCredentials"));
  const worker = read("src/services/worker-daemon.ts");
  assert.ok(worker.includes("@/server/services/"));
  assert.ok(!worker.includes("@/server/actions/"));
});
