import { db } from "../src/server/db";

async function inspectDetails() {
  const integrations = await db.integrationAccount.findMany();
  console.log("=== INTEGRATION ACCOUNTS ===");
  console.log(JSON.stringify(integrations, null, 2));

  const syncRuns = await db.syncRun.findMany();
  console.log("=== SYNC RUNS ===");
  console.log(JSON.stringify(syncRuns, null, 2));
}

inspectDetails().catch(console.error).finally(() => process.exit(0));
