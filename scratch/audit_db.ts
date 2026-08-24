import { db } from "../src/server/db";

async function auditDatabase() {
  console.log("=== AUDITORIA COMPLETA DO BANCO LOCAL DE DESENVOLVIMENTO ===");

  const users = await db.user.findMany();
  console.log(`\n--- USERS (${users.length}) ---`);
  users.forEach((u) => console.log(`User: ${u.id} | Email: ${u.email} | Name: ${u.name}`));

  const workspaces = await db.workspace.findMany();
  console.log(`\n--- WORKSPACES (${workspaces.length}) ---`);
  workspaces.forEach((w) => console.log(`Workspace: ${w.id} | Name: ${w.name} | Owner: ${w.ownerUserId}`));

  const integrations = await db.integrationAccount.findMany();
  console.log(`\n--- INTEGRATION ACCOUNTS (${integrations.length}) ---`);
  integrations.forEach((i) =>
    console.log(
      `Integration: ${i.id} | Workspace: ${i.workspaceId} | Provider: ${i.provider} | Status: ${i.status} | Env: ${i.environment} | Name: ${i.displayName} | LastSync: ${i.lastSyncAt}`
    )
  );

  const extTxs = await db.externalTransaction.findMany();
  console.log(`\n--- EXTERNAL TRANSACTIONS (${extTxs.length}) ---`);
  let creditSum = 0;
  let debitSum = 0;
  extTxs.forEach((t) => {
    const val = Number(t.amountCents) / 100;
    if (t.direction === "CREDIT") creditSum += val;
    if (t.direction === "DEBIT") debitSum += val;
    console.log(
      `Tx: ${t.id} | ExtID: ${t.externalId} | Source: ${t.source} | Provider: ${t.provider} | Dir: ${t.direction} | Amount: R$ ${val} | Net: R$ ${Number(t.netAmountCents) / 100} | Occurred: ${t.occurredAt.toISOString()} | Desc: ${t.description}`
    );
  });
  console.log(`Soma de Créditos: R$ ${creditSum.toFixed(2)} | Soma de Débitos: R$ ${debitSum.toFixed(2)} | Saldo Resultante: R$ ${(creditSum - debitSum).toFixed(2)}`);

  const items = await db.financialItem.findMany({
    include: { installments: true, contact: true, category: true },
  });
  console.log(`\n--- FINANCIAL ITEMS (${items.length}) ---`);
  items.forEach((fi) => {
    console.log(
      `Item: ${fi.id} | Dir: ${fi.direction} | Kind: ${fi.kind} | Title: ${fi.title} | Status: ${fi.status} | Total: R$ ${Number(fi.totalAmountCents) / 100} | Contact: ${fi.contact?.name || "N/A"}`
    );
    fi.installments.forEach((inst) => {
      console.log(
        `   -> Installment: ${inst.id} | Seq: ${inst.sequence} | Amount: R$ ${Number(inst.amountCents) / 100} | Status: ${inst.status} | Due: ${inst.dueDate.toISOString()}`
      );
    });
  });

  const contacts = await db.contact.findMany();
  console.log(`\n--- CONTACTS (${contacts.length}) ---`);
  contacts.forEach((c) => console.log(`Contact: ${c.id} | Name: ${c.name} | Debtor: ${c.isDebtor} | Payee: ${c.isPayee}`));

  const syncRuns = await db.syncRun.findMany();
  console.log(`\n--- SYNC RUNS (${syncRuns.length}) ---`);
  syncRuns.forEach((s) => console.log(`SyncRun: ${s.id} | Source: ${s.source} | Status: ${s.status} | RemoteID: ${s.remoteReportId} | Inserted: ${s.insertedCount}`));
}

auditDatabase()
  .catch(console.error)
  .finally(() => process.exit(0));
