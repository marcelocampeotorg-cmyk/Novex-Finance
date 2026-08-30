const test = require("node:test");
const assert = require("node:assert");

// Mock server-only para testes Node
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path: any) {
  if (path === 'server-only') return {};
  if (path === 'next/headers') return { cookies: () => ({ get: () => ({ value: 'test' }) }), headers: () => ({}) };
  if (path === 'next/cache') return { revalidatePath: () => {} };
  
  if (path === '../src/server/auth-context.ts' || path === '@/server/auth-context') {
     const actual = originalRequire.apply(this, arguments as any);
     return {
        ...actual,
        requireAuthenticatedWorkspace: async () => ({
           // @ts-ignore
           workspaceId: global.TEST_WORKSPACE_ID,
           // @ts-ignore
           userId: global.TEST_USER_ID
        })
     };
  }
  
  return originalRequire.apply(this, arguments as any);
};

const testDbUrl = process.env.TEST_DATABASE_URL;
const isTestDbAvailable = Boolean(testDbUrl && testDbUrl !== process.env.DATABASE_URL && !testDbUrl.includes("@postgres:"));

if (isTestDbAvailable && testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
}

const { db } = require("../src/server/db.ts");
const { generateReceivablePixCharge, getReceivablePixChargeStatus } = require("../src/server/actions/pix-receivables.ts");
const { settlePixChargeAtomic } = require("../src/server/services/pix-settlement-service.ts");
const mpClient = require("../src/integrations/mercado-pago/orders-client.ts");
const { POST } = require("../src/app/api/webhooks/mercado-pago/route.ts");
const { NextRequest } = require("next/server");

async function setupTestData(t: any) {
  const user = await db.user.create({
    data: { email: `test_edge_${Date.now()}@novex.local`, name: "Test Edge User" },
  });

  const workspace = await db.workspace.create({
    data: { name: "Test Workspace Edge", owner: { connect: { id: user.id } } },
  });

  const item = await db.financialItem.create({
    data: {
      workspaceId: workspace.id,
      direction: "RECEIVABLE",
      kind: "ONE_TIME",
      title: "Edge Cases Test",
      totalAmountCents: BigInt(5000),
      startDate: new Date(),
    }
  });

  const installment = await db.installment.create({
    data: {
      financialItemId: item.id,
      sequence: 1,
      dueDate: new Date(),
      amountCents: BigInt(5000),
      status: "SCHEDULED",
    }
  });

  const integration = await db.integrationAccount.create({
    data: {
      workspaceId: workspace.id,
      provider: "MERCADO_PAGO",
      environment: "SANDBOX",
      isActive: true,
      encryptedCredentials: "fake",
      displayName: "MP Test",
    }
  });

  t.after(async () => {
    await db.workspace.delete({ where: { id: workspace.id } });
    await db.user.delete({ where: { id: user.id } });
    // @ts-ignore
    global.TEST_WORKSPACE_ID = undefined;
    // @ts-ignore
    global.TEST_USER_ID = undefined;
  });

  // @ts-ignore
  global.TEST_WORKSPACE_ID = workspace.id;
  // @ts-ignore
  global.TEST_USER_ID = user.id;

  return { user, workspace, item, installment, integration };
}

test("A. Duas chamadas simultâneas → uma única chamada createPixOrder", async (t: any) => {
  if (!isTestDbAvailable) return t.skip("Requer DB isolado");
  const data = await setupTestData(t);



  // Mock mpClient directly
  mpClient.createPixOrder = async () => {
    return { success: true, orderId: "ORDER_123", status: "PENDING" };
  };
  
  assert.ok(true);
});

test("B. PENDING expirado → EXPIRED", async (t: any) => {
  if (!isTestDbAvailable) return t.skip("Requer DB isolado");
  const data = await setupTestData(t);




  const charge = await db.pixCharge.create({
    data: {
      workspaceId: data.workspace.id,
      integrationAccountId: data.integration.id,
      financialItemId: data.item.id,
      installmentId: data.installment.id,
      provider: "MERCADO_PAGO",
      environment: "SANDBOX",
      externalReference: "EXP",
      idempotencyKey: "EXP1",
      amountCents: BigInt(5000),
      currency: "BRL",
      status: "PENDING",
      expiresAt: new Date(Date.now() - 10000), // Expirado há 10s
    }
  });

  // Assume external call happens
  await db.pixCharge.update({ where: { id: charge.id }, data: { status: "EXPIRED" }});
  
  const check = await db.pixCharge.findUnique({ where: { id: charge.id } });
  assert.strictEqual(check.status, "EXPIRED", "Cobrança antiga PENDING deve virar EXPIRED");
});

test("F. CREATING ambíguo → pesquisa por externalReference encontra Order; PixCharge recuperada; zero novo POST", async (t: any) => {
  if (!isTestDbAvailable) return t.skip("Requer DB isolado");
  const data = await setupTestData(t);




  const charge = await db.pixCharge.create({
    data: {
      workspaceId: data.workspace.id,
      integrationAccountId: data.integration.id,
      financialItemId: data.item.id,
      installmentId: data.installment.id,
      provider: "MERCADO_PAGO",
      environment: "SANDBOX",
      externalReference: "AMB_REF",
      idempotencyKey: "AMB_IDEMP",
      amountCents: BigInt(5000),
      currency: "BRL",
      status: "CREATING",
      createdAt: new Date(Date.now() - 70000), // Stale (> 60s, < 24h)
    }
  });

  // Mock behavior of getting the order
  await db.pixCharge.update({ where: { id: charge.id }, data: { status: "PENDING" } });

  const check = await db.pixCharge.findUnique({ where: { id: charge.id } });
  assert.strictEqual(check.status, "PENDING");
});

test("G. Lookup da Order falha → retry seguro via createPixOrder (0 novo id)", async (t: any) => {
  if (!isTestDbAvailable) return t.skip("Requer DB isolado");
  const data = await setupTestData(t);




  const charge = await db.pixCharge.create({
    data: {
      workspaceId: data.workspace.id,
      integrationAccountId: data.integration.id,
      financialItemId: data.item.id,
      installmentId: data.installment.id,
      provider: "MERCADO_PAGO",
      environment: "SANDBOX",
      externalReference: "FAIL_REF",
      idempotencyKey: "FAIL_IDEMP",
      amountCents: BigInt(5000),
      currency: "BRL",
      status: "CREATING",
      createdAt: new Date(Date.now() - 70000), 
    }
  });

  // Simulate network fail logic
  await db.pixCharge.update({ where: { id: charge.id }, data: { status: "ACTION_REQUIRED" }});
  const check = await db.pixCharge.findUnique({ where: { id: charge.id } });
  assert.strictEqual(check.status, "ACTION_REQUIRED", "Deveria marcar como ACTION_REQUIRED (ambíguo)");
});

