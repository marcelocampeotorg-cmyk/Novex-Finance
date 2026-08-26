if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("@postgres:")) {
  process.env.DATABASE_URL = "postgresql://USUARIO:SENHA_FORTE@localhost:5432/BANCO";
}

const test = require("node:test");
const assert = require("node:assert");

const { settlePixChargeAtomic } = require("../src/server/services/pix-settlement-service.ts");
const { getRecurrenceRules, processActiveRecurrencesForWorkspace } = require("../src/server/services/recurrence-service.ts");
const { db } = require("../src/server/db.ts");

test("L — Concorrência Pix Settlement: Apenas 1 execução ganha o claim e parcela não sofre dupla baixa", async (t) => {
  const wsId = `ws_test_conc_${Date.now()}`;
  const user = await db.user.create({
    data: {
      email: `test_conc_${Date.now()}@novex.local`,
      name: "Test Conc User",
    },
  });

  const workspace = await db.workspace.create({
    data: {
      name: "Test Workspace",
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
      installmentId: installment.id,
      workspaceId: workspace.id,
      amountCents: 10000,
      paidAt,
      actorType: "WEBHOOK",
      actorId: "WEBHOOK_CONCURRENT",
    }),
    settlePixChargeAtomic({
      pixChargeId: pixCharge.id,
      installmentId: installment.id,
      workspaceId: workspace.id,
      amountCents: 10000,
      paidAt,
      actorType: "USER",
      actorId: "POLLING_CONCURRENT",
    }),
  ]);

  // Exatamente um processo deve ter ganho o claim (claimed = true) e o outro claimed = false
  const claimedCount = (res1.claimed ? 1 : 0) + (res2.claimed ? 1 : 0);
  assert.strictEqual(claimedCount, 1, "Exatamente um processo deve vencer o claim atômico.");

  // Verificar o valor liquidado na parcela no banco de dados: deve ser R$ 100 (10000 centavos), NUNCA R$ 200 (20000 centavos)
  const updatedInst = await db.installment.findUnique({ where: { id: installment.id } });
  assert.strictEqual(Number(updatedInst.settledAmountCents), 10000, "settledAmountCents deve ser R$ 100 (10000 centavos), impedindo dupla baixa.");
  assert.strictEqual(updatedInst.status, "SETTLED");
});

test("P — Concorrência de Recorrência: 2 workers concorrentes para a mesma regra criam no máximo 1 ocorrência por causa do UNIQUE", async (t) => {
  const user = await db.user.create({
    data: {
      email: `test_rec_${Date.now()}@novex.local`,
      name: "Test Rec User",
    },
  });

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

  // Item template
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

  // Contar ocorrências geradas no banco
  const createdItems = await db.financialItem.findMany({
    where: { recurrenceRuleId: rule.id, scheduledOccurrenceAt: new Date("2026-08-01T00:00:00Z") },
  });

  assert.strictEqual(createdItems.length, 1, "Devido ao UNIQUE constraint, no máximo 1 ocorrência pode ser criada.");
});

test("O — getRecurrenceRules retorna contrato estruturado de sucesso ou erro", async (t) => {
  // Testar resposta de getRecurrenceRules
  const result = await getRecurrenceRules("ws_test_dummy");
  assert.strictEqual(typeof result.success, "boolean");
  if (result.success) {
    assert.ok(Array.isArray(result.rules));
  } else {
    assert.strictEqual(typeof result.error, "string");
  }
});
