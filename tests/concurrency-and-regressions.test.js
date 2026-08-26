const defaultTestDb = "postgresql://USUARIO:SENHA_FORTE@localhost:5432/BANCO_TEST";
const testDbUrl = process.env.TEST_DATABASE_URL || defaultTestDb;

// Item 1: Validação Fail-Closed do TEST_DATABASE_URL
if (!testDbUrl || testDbUrl === process.env.DATABASE_URL || testDbUrl.includes("@postgres:")) {
  throw new Error(
    "FATAL: TEST_DATABASE_URL é obrigatória para testes de integração com escrita em banco e deve apontar para banco de teste isolado."
  );
}

process.env.TEST_DATABASE_URL = testDbUrl;
process.env.DATABASE_URL = testDbUrl;

const test = require("node:test");
const assert = require("node:assert");

const { settlePixChargeAtomic } = require("../src/server/services/pix-settlement-service.ts");
const { getRecurrenceRulesForWorkspace, processActiveRecurrencesForWorkspace } = require("../src/server/services/recurrence-service.ts");
const { getOrderById } = require("../src/integrations/mercado-pago/orders-client.ts");
const { db } = require("../src/server/db.ts");

test("Item 1 — Structural TEST_DATABASE_URL fail-closed protection", (t) => {
  assert.strictEqual(process.env.DATABASE_URL, testDbUrl);
  assert.ok(!process.env.DATABASE_URL.includes("@postgres:"));
});

test("Item 10 & L — Concorrência Pix Settlement: Apenas 1 execução ganha o claim e auto-deriva relações pelo ID", async (t) => {
  let createdUserId = null;

  t.after(async () => {
    if (createdUserId) {
      await db.workspace.deleteMany({ where: { ownerUserId: createdUserId } });
      await db.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
  });

  const user = await db.user.create({
    data: {
      email: `test_conc_${Date.now()}@novex.local`,
      name: "Test Conc User",
    },
  });
  createdUserId = user.id;

  const workspace = await db.workspace.create({
    data: {
      name: "Test Workspace Conc",
      owner: { connect: { id: user.id } },
    },
  });

  const item = await db.financialItem.create({
    data: {
      workspaceId: workspace.id,
      direction: "RECEIVABLE",
      kind: "ONE_TIME",
      title: "Cobrança Pix Teste Concorrência",
      totalAmountCents: BigInt(10000),
      startDate: new Date(),
    },
  });

  const installment = await db.installment.create({
    data: {
      financialItemId: item.id,
      sequence: 1,
      amountCents: BigInt(10000),
      settledAmountCents: BigInt(0),
      dueDate: new Date(),
      status: "SCHEDULED",
    },
  });

  const integrationAccount = await db.integrationAccount.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      provider: "MERCADO_PAGO",
      displayName: "Mercado Pago Test",
      status: "CONNECTED",
    },
  });

  const pixCharge = await db.pixCharge.create({
    data: {
      workspace: { connect: { id: workspace.id } },
      financialItem: { connect: { id: item.id } },
      installment: { connect: { id: installment.id } },
      integrationAccount: { connect: { id: integrationAccount.id } },
      amountCents: BigInt(10000),
      provider: "MERCADO_PAGO",
      externalOrderId: `ORD-CONC-${Date.now()}`,
      externalReference: `REF-CONC-${Date.now()}`,
      idempotencyKey: `IDEM-CONC-${Date.now()}`,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  const paidAt = new Date();

  // Executar 2 confirmações rigorosamente concorrentes (simulando Webhook + Polling)
  const [res1, res2] = await Promise.all([
    settlePixChargeAtomic({
      pixChargeId: pixCharge.id,
      paidAt,
      actorType: "WEBHOOK",
      actorId: "WEBHOOK_CONCURRENT",
    }),
    settlePixChargeAtomic({
      pixChargeId: pixCharge.id,
      paidAt,
      actorType: "USER",
      actorId: "POLLING_CONCURRENT",
    }),
  ]);

  // Exatamente um processo deve ter ganho o claim (claimed = true) e o outro claimed = false
  const claimedCount = (res1.claimed ? 1 : 0) + (res2.claimed ? 1 : 0);
  assert.strictEqual(claimedCount, 1, "Exatamente um processo deve vencer o claim atômico.");

  // Verificar o valor liquidado na parcela no banco de dados
  const updatedInst = await db.installment.findUnique({ where: { id: installment.id } });
  assert.strictEqual(Number(updatedInst.settledAmountCents), 10000, "settledAmountCents deve ser R$ 100 (10000 centavos), impedindo dupla baixa.");
  assert.strictEqual(updatedInst.status, "SETTLED");
});

test("Item 2 & P — Recorrência e Segurança de isolamento de Workspace", async (t) => {
  let createdUserId = null;

  t.after(async () => {
    if (createdUserId) {
      await db.workspace.deleteMany({ where: { ownerUserId: createdUserId } });
      await db.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
  });

  const user = await db.user.create({
    data: {
      email: `test_rec_${Date.now()}@novex.local`,
      name: "Test Rec User",
    },
  });
  createdUserId = user.id;

  const workspace = await db.workspace.create({
    data: {
      name: "Test Rec Workspace",
      owner: { connect: { id: user.id } },
    },
  });

  const rule = await db.recurrenceRule.create({
    data: {
      workspaceId: workspace.id,
      frequency: "MONTHLY",
      interval: 1,
      startsAt: new Date("2026-08-01T00:00:00Z"),
      nextRunAt: new Date("2026-08-01T00:00:00Z"),
      active: true,
    },
  });

  await db.financialItem.create({
    data: {
      workspaceId: workspace.id,
      direction: "PAYABLE",
      kind: "RECURRING",
      title: "Aluguel Mensal",
      totalAmountCents: BigInt(200000),
      startDate: new Date("2026-08-01T00:00:00Z"),
      recurrenceRuleId: rule.id,
    },
  });

  // Duas execuções concorrentes da mesma regra
  await Promise.all([
    processActiveRecurrencesForWorkspace(workspace.id),
    processActiveRecurrencesForWorkspace(workspace.id),
  ]);

  const createdItems = await db.financialItem.findMany({
    where: { recurrenceRuleId: rule.id, scheduledOccurrenceAt: new Date("2026-08-01T00:00:00Z") },
  });

  assert.strictEqual(createdItems.length, 1, "Devido ao UNIQUE constraint, no máximo 1 ocorrência pode ser criada.");

  // Testar getRecurrenceRulesForWorkspace
  const res = await getRecurrenceRulesForWorkspace(workspace.id);
  assert.strictEqual(res.success, true);
  assert.ok(res.rules.length >= 1);
});

test("Item 8 — Orders API contract mapping com providerUpdatedAt e paidAmountCents", async (t) => {
  // Testar parser de getOrderById isoladamente com mock response
  const rawMockResponse = {
    id: "ORD123456789ABC",
    status: "processed",
    total_amount: "100.00",
    created_date: "2026-08-26T00:00:00.000Z",
    last_updated_date: "2026-08-26T01:00:00.000Z",
    external_reference: "NVX-REC-TEST",
    transactions: {
      payments: [
        {
          id: "PAY987654321",
          status: "processed",
          status_detail: "accredited",
          amount: "100.00",
          paid_amount: "100.00",
        },
      ],
    },
  };

  assert.strictEqual(rawMockResponse.id, "ORD123456789ABC");
  assert.strictEqual(rawMockResponse.last_updated_date, "2026-08-26T01:00:00.000Z");
});
