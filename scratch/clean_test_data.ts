import { db } from "../src/server/db";

async function cleanTestData() {
  console.log("=== EXECUTANDO LIMPEZA DE DADOS DE TESTE E FIXTURES ===");

  // 1. Limpar Reconciliations, LedgerEntries, PixCharges, ExternalTransactions, SyncRuns
  const deletedReconciliations = await db.reconciliation.deleteMany({});
  console.log(`Reconciliações removidas: ${deletedReconciliations.count}`);

  const deletedLedgerEntries = await db.ledgerEntry.deleteMany({});
  console.log(`Entradas do Ledger removidas: ${deletedLedgerEntries.count}`);

  const deletedPixCharges = await db.pixCharge.deleteMany({});
  console.log(`Cobranças Pix removidas: ${deletedPixCharges.count}`);

  const deletedSyncRuns = await db.syncRun.deleteMany({});
  console.log(`SyncRuns removidos: ${deletedSyncRuns.count}`);

  const deletedExtTxs = await db.externalTransaction.deleteMany({});
  console.log(`Movimentações Externas removidas: ${deletedExtTxs.count}`);

  // 2. Limpar FinancialItems e Installments de teste
  const deletedInstallments = await db.installment.deleteMany({});
  console.log(`Parcelas removidas: ${deletedInstallments.count}`);

  const deletedItems = await db.financialItem.deleteMany({});
  console.log(`Itens Financeiros removidos: ${deletedItems.count}`);

  const deletedContacts = await db.contact.deleteMany({});
  console.log(`Contatos removidos: ${deletedContacts.count}`);

  // 3. Resetar lastSyncAt da IntegrationAccount se não houver relatório real
  await db.integrationAccount.updateMany({
    data: {
      lastSyncAt: null,
      lastValidatedAt: null,
      status: "DISCONNECTED",
    },
  });
  console.log(`Contas de Integração resetadas para estado limpo (DISCONNECTED, lastSyncAt: null).`);

  console.log("=== LIMPEZA DE DADOS DE TESTE CONCLUÍDA COM SUCESSO ===");
}

cleanTestData().catch(console.error).finally(() => process.exit(0));
