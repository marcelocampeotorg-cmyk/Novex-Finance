"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { getActiveMercadoPagoIntegration } from "@/server/actions/integrations";
import { parseMercadoPagoCredentials } from "@/lib/server/credentials-crypto";
import { MercadoPagoReportsClient, MercadoPagoRawTransaction } from "@/integrations/mercado-pago/reports-client";
import { categorizeTransactionDescription, runAutomaticReconciliationEngine } from "@/server/actions/reconciliation";
import { INTERNAL_WORKER_CONTEXT } from "@/server/internal-context";

export async function getExternalTransactions(period: string = "MONTHLY") {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (period === "DAILY") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === "WEEKLY") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "BIWEEKLY") {
      startDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    } else if (period === "YEARLY") {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      // Default to MONTHLY
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const txs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        reconciliations: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { occurredAt: "desc" },
    });

    const results = await Promise.all(txs.map(async (tx) => {
      const activeRec = tx.reconciliations[0];
      const category = await categorizeTransactionDescription(tx.description, workspaceId);
      return {
        id: tx.id,
        provider: tx.provider,
        externalId: tx.externalId,
        direction: tx.direction,
        type: tx.type,
        status: tx.status,
        amountCents: Number(tx.amountCents),
        feeCents: Number(tx.feeCents),
        netAmountCents: Number(tx.netAmountCents),
        occurredAt: tx.occurredAt.toISOString(),
        counterpartName: tx.counterpartName || undefined,
        counterpartDocument: tx.counterpartDocument || undefined,
        description: tx.description,
        txid: tx.txid || undefined,
        rawReference: tx.rawReference || undefined,
        reconciliationStatus: activeRec ? activeRec.status : "UNMATCHED",
        matchedInstallmentId: activeRec?.installmentId || undefined,
        reconciliationId: activeRec?.id || undefined,
        reconciliationReasons: activeRec?.reasons || [],
        category,
        confidenceScore: activeRec?.score || undefined,
      };
    }));
    return results;
  } catch (error) {
    console.error("Erro ao buscar movimentações externas:", error);
    throw new Error(`Falha ao consultar movimentações externas: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Importar lote de movimentações externas (com criação ATÔMICA do LedgerEntry correspondente)
 */
export async function importExternalTransactions(
  rawTransactions: MercadoPagoRawTransaction[],
  integrationAccountId: string | null = null,
  source: "MERCADO_PAGO_API" | "CSV_IMPORT" | "MANUAL_ADJUSTMENT" = "MERCADO_PAGO_API",
  provider: "MERCADO_PAGO" | "EVOLUTION_API" | null = "MERCADO_PAGO",
  internalContext?: symbol,
  internalWorkspaceId?: string,
) {
  try {
    const workspaceId = internalContext === INTERNAL_WORKER_CONTEXT && internalWorkspaceId
      ? internalWorkspaceId
      : (await requireAuthenticatedWorkspace()).workspaceId;

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const raw of rawTransactions) {
      const occurredDate = new Date(raw.occurredAt);

      try {
        await db.$transaction(async (tx) => {
          const existingTx = await tx.externalTransaction.findUnique({
            where: {
              workspaceId_source_externalId: {
                workspaceId,
                source,
                externalId: raw.externalId,
              },
            },
          });

          if (existingTx) {
            await tx.externalTransaction.update({
              where: { id: existingTx.id },
              data: {
                description: raw.description,
                counterpartName: raw.counterpartName || null,
                counterpartDocument: raw.counterpartDocument || null,
              },
            });
            updatedCount++;
          } else {
            const newTx = await tx.externalTransaction.create({
              data: {
                workspaceId,
                integrationAccountId: integrationAccountId || null,
                provider: provider || null,
                source,
                externalId: raw.externalId,
                direction: raw.direction,
                type: raw.type,
                status: "APPROVED",
                amountCents: BigInt(raw.amountCents),
                feeCents: BigInt(raw.feeCents ?? 0),
                netAmountCents: BigInt(raw.netAmountCents),
                occurredAt: occurredDate,
                counterpartName: raw.counterpartName || null,
                counterpartDocument: raw.counterpartDocument || null,
                txid: raw.txid || null,
                description: raw.description,
                rawReference: raw.rawReference || null,
                rawProviderData: raw.rawProviderData || undefined,
              },
            });

            // Regra 3: Fato financeiro nasce na ingestão -> cria LedgerEntry no mesmo momento (1x1 atômico)
            await tx.ledgerEntry.create({
              data: {
                workspaceId,
                externalTransactionId: newTx.id,
                direction: newTx.direction,
                amountCents: newTx.netAmountCents, // Regra 8: Usa impacto líquido oficial netAmountCents
                occurredAt: newTx.occurredAt,
                sourceType: newTx.source,
                sourceId: newTx.externalId,
                categoryId: null,
              },
            });
            insertedCount++;
          }
        });
      } catch (e) {
        console.error("Erro ao importar transação", raw.externalId, e);
        skippedCount++;
      }
    }

    // Disparar motor de conciliação automática após importação
    const reconResult = internalContext === INTERNAL_WORKER_CONTEXT
      ? await runAutomaticReconciliationEngine(INTERNAL_WORKER_CONTEXT, workspaceId)
      : await runAutomaticReconciliationEngine();

    revalidatePath("/movimentacoes");
    revalidatePath("/relatorios");
    revalidatePath("/");

    return {
      success: true,
      insertedCount,
      updatedCount,
      skippedCount,
      autoMatchedCount: reconResult.autoMatchedCount || 0,
    };
  } catch (error: any) {
    console.error("Erro na importação de movimentações:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Pipeline Oficial do Relatório Dinheiro em Conta (Settlement Report - Assíncrono)
 */
export async function syncMercadoPagoStatement(
  opts?: { force?: boolean; syncRunId?: string; integrationAccountId?: string | null; internalContext?: symbol } | boolean
) {
  const isForce = typeof opts === "boolean" ? opts : opts?.force ?? false;
  const syncRunId = typeof opts === "object" ? opts?.syncRunId : undefined;
  const targetIntegrationId = typeof opts === "object" ? opts?.integrationAccountId : undefined;
  const isInternalWorker = typeof opts === "object" && opts.internalContext === INTERNAL_WORKER_CONTEXT;

  let workspaceId: string;
  let account: any;

  if (targetIntegrationId) {
    if (!isInternalWorker || !syncRunId) throw new Error("Acesso interno do worker inválido.");
    const acc = await db.integrationAccount.findUnique({ where: { id: targetIntegrationId } });
    if (!acc) throw new Error("Conta de integração não encontrada.");
    workspaceId = acc.workspaceId;
    account = acc;
  } else {
    const auth = await requireAuthenticatedWorkspace();
    workspaceId = auth.workspaceId;
    account = await getActiveMercadoPagoIntegration(workspaceId);
  }

  // Cache de 5 minutos se não for forçado e já possuir sincronização recente
  const CACHE_MINUTES = 5;
  if (!isForce && account.lastSyncAt) {
    const now = new Date();
    const diffInMinutes = (now.getTime() - account.lastSyncAt.getTime()) / (1000 * 60);
    if (diffInMinutes < CACHE_MINUTES) {
      return {
        success: true,
        cached: true,
        message: "Sincronização recente (menos de 5 min). Retornando dados locais.",
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        autoMatchedCount: 0,
      };
    }
  }

  // 1. Verificar se existe SyncRun em andamento (PROCESSING) ou criar novo
  let syncRun = syncRunId ? await db.syncRun.findFirst({
    where: { id: syncRunId, workspaceId, integrationAccountId: account.id, status: "PROCESSING" },
  }) : await db.syncRun.findFirst({
    where: { workspaceId, integrationAccountId: account.id, status: "PROCESSING" },
    orderBy: { createdAt: "desc" },
  });
  if (syncRunId && !syncRun) throw new Error("SyncRun específico não encontrado ou não pertence à integração/workspace.");

  const beginDate = syncRun ? syncRun.beginDate : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = syncRun ? syncRun.endDate : new Date();

  if (!syncRun) {
    syncRun = await db.syncRun.create({
      data: {
        workspaceId,
        integrationAccountId: account.id,
        source: "MERCADO_PAGO_API",
        status: "PROCESSING",
        beginDate,
        endDate,
        startedAt: new Date(),
      },
    });
  }

  try {
    const credentials = parseMercadoPagoCredentials(account.encryptedCredentials!);
    const client = new MercadoPagoReportsClient(credentials.accessToken);

    // 2. Solicitar geração assíncrona do Settlement Report se ainda não tiver ID remoto
    if (!syncRun.remoteReportId && !syncRun.remoteFileName) {
      const requestRes = await client.requestSettlementReport(beginDate, endDate);
      if (!requestRes.success) {
        throw new Error(requestRes.error || "Falha ao solicitar relatório de liquidação no Mercado Pago.");
      }
      if (requestRes.reportId || requestRes.fileFileName) {
        await db.syncRun.update({
          where: { id: syncRun.id },
          data: {
            remoteReportId: requestRes.reportId,
            remoteFileName: requestRes.fileFileName,
          },
        });
        syncRun.remoteReportId = requestRes.reportId || null;
        syncRun.remoteFileName = requestRes.fileFileName || null;
      }
    }

    // 3. Consultar relatórios de liquidação gerados via endpoint oficial /search
    const reports = await client.searchSettlementReports();
    const readyReport = reports.find(
      (r) =>
        r.status === "READY" &&
        ((syncRun.remoteReportId && r.id === syncRun.remoteReportId) ||
          (syncRun.remoteFileName && r.fileName === syncRun.remoteFileName))
    );

    if (!readyReport || (!readyReport.fileName && !readyReport.downloadUrl)) {
      // Relatório ainda em processamento (PROCESSING não é tratado como erro)
      return {
        success: true,
        status: "PROCESSING",
        message: "Relatório de liquidação em processamento no Mercado Pago. Aguarde a conclusão da geração.",
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        autoMatchedCount: 0,
      };
    }

    // 4. Efetuar download do relatório pelo file_name oficial (ou downloadUrl) e parsear movimentações
    let csvContent = "";
    if (readyReport.fileName) {
      csvContent = await client.downloadSettlementReport(readyReport.fileName);
    } else if (readyReport.downloadUrl) {
      const fileRes = await fetch(readyReport.downloadUrl, {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      if (!fileRes.ok) {
        throw new Error(`Falha no download do relatório (HTTP ${fileRes.status})`);
      }
      csvContent = await fileRes.text();
    }

    const parseResult = client.parseSettlementReportCsv(csvContent);

    if (parseResult.rejectedCount > 0 && parseResult.validCount === 0) {
      throw new Error(`Falha no parse do relatório de liquidação. Todas as ${parseResult.rejectedCount} linhas foram rejeitadas por inconsistência.`);
    }

    // 5. Executar importação oficial dos dados validados
    const importResult = await importExternalTransactions(
      parseResult.transactions,
      account.id,
      "MERCADO_PAGO_API",
      "MERCADO_PAGO",
      INTERNAL_WORKER_CONTEXT,
      workspaceId,
    );

    if (!importResult.success) {
      throw new Error(importResult.error || "Erro ao importar transações do relatório");
    }

    // 6. Atualizar status final do SyncRun (SUCCESS ou PARTIAL)
    // Regra 70: Se parseResult.rejectedCount > 0 OU importResult.skippedCount > 0 => PARTIAL
    const hasFailures = parseResult.rejectedCount > 0 || (importResult.skippedCount || 0) > 0;
    const finalRunStatus = hasFailures ? "PARTIAL" : "SUCCESS";

    await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: finalRunStatus,
        finishedAt: new Date(),
        insertedCount: importResult.insertedCount,
        updatedCount: importResult.updatedCount,
        skippedCount: (importResult.skippedCount || 0) + parseResult.rejectedCount,
        errorMessage: parseResult.errors.length > 0 ? parseResult.errors.slice(0, 5).join(" | ") : null,
      },
    });

    // Regra 10 & 11: Fechamento bem-sucedido do SyncRun atualiza lastSyncAt e horizonte de cobertura
    await db.integrationAccount.update({
      where: { id: account.id },
      data: {
        lastSyncAt: new Date(),
        firstImportedAt: account.firstImportedAt || beginDate,
        coverageStart: !account.coverageStart || beginDate < account.coverageStart ? beginDate : account.coverageStart,
        coverageEnd: !account.coverageEnd || endDate > account.coverageEnd ? endDate : account.coverageEnd,
      },
    });

    return {
      ...importResult,
      status: finalRunStatus,
      rejectedCount: parseResult.rejectedCount,
      diagnostics: parseResult.errors,
    };
  } catch (error: any) {
    console.error("Erro no pipeline de Dinheiro em Conta do Mercado Pago:", error);

    await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: error.message || "Erro no pipeline de sync",
      },
    });
    throw error;
  }
}

/**
 * Importar extrato manual via CSV sem criar IntegrationAccount Mercado Pago fake
 */
export async function importCsvExternalTransactions(rawTransactions: MercadoPagoRawTransaction[]) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    if (!rawTransactions || rawTransactions.length === 0) {
      return { success: false, error: "Nenhuma transação para importar." };
    }

    // Registrar SyncRun para auditoria de importação CSV sem vínculo de conta externa Mercado Pago
    const syncRun = await db.syncRun.create({
      data: {
        workspaceId,
        integrationAccountId: null,
        source: "CSV_IMPORT",
        status: "PROCESSING",
        beginDate: new Date(),
        endDate: new Date(),
        startedAt: new Date(),
      },
    });

    const importResult = await importExternalTransactions(
      rawTransactions,
      null, // integrationAccountId is null for CSV
      "CSV_IMPORT",
      null  // provider is null for CSV
    );

    await db.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: importResult.success ? "SUCCESS" : "FAILED",
        finishedAt: new Date(),
        insertedCount: importResult.insertedCount || 0,
        updatedCount: importResult.updatedCount || 0,
        skippedCount: importResult.skippedCount || 0,
        errorMessage: importResult.error,
      },
    });

    return importResult;
  } catch (error: any) {
    console.error("Erro na importação manual via CSV:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Marcar movimentação como ignorada no motor de conciliação
 */
export async function ignoreExternalTransaction(externalTransactionId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    await db.reconciliation.create({
      data: {
        workspaceId,
        externalTransactionId,
        status: "IGNORED",
        score: 0,
        matchedBy: "USER",
        matchedAt: new Date(),
      },
    });

    revalidatePath("/movimentacoes");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao ignorar transação:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Obter resumo consolidado das movimentações e conciliação
 */
export async function getReconciliationSummary(period: string = "MONTHLY") {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (period === "DAILY") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === "WEEKLY") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "BIWEEKLY") {
      startDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    } else if (period === "YEARLY") {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      // Default to MONTHLY
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const txs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        reconciliations: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    let totalCount = txs.length;
    let matchedCount = 0;
    let suggestedCount = 0;
    let unmatchedCount = 0;
    let totalCreditCents = 0;
    let totalDebitCents = 0;
    let totalFeeCents = 0;

    for (const tx of txs) {
      const rec = tx.reconciliations[0];
      const status = rec ? rec.status : "UNMATCHED";

      if (status === "MATCHED") matchedCount++;
      else if (status === "SUGGESTED") suggestedCount++;
      else if (status === "UNMATCHED") unmatchedCount++;

      const amt = Number(tx.amountCents);
      const fee = Number(tx.feeCents);
      totalFeeCents += fee;

      if (tx.direction === "CREDIT") {
        totalCreditCents += amt;
      } else {
        totalDebitCents += amt;
      }
    }

    return {
      totalCount,
      matchedCount,
      suggestedCount,
      unmatchedCount,
      totalCreditCents,
      totalDebitCents,
      totalFeeCents,
      reconciliationPercentage: totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0,
    };
  } catch (error) {
    console.error("Erro ao buscar resumo de conciliação:", error);
    throw new Error(`Falha ao consultar resumo de conciliação: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function matchReconciliation(externalTransactionId: string, installmentId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    return await db.$transaction(async (tx) => {
      const rec = await tx.reconciliation.create({
        data: {
          workspaceId,
          externalTransactionId,
          installmentId,
          status: "MATCHED",
          score: 100,
          matchedBy: "USER",
          matchedAt: new Date(),
        },
      });

      const extTx = await tx.externalTransaction.findUnique({
        where: { id: externalTransactionId },
      });

      if (!extTx || extTx.workspaceId !== workspaceId) throw new Error("Movimentação não encontrada no workspace.");
      const installment = await tx.installment.findFirst({ where: { id: installmentId, financialItem: { workspaceId } } });
      if (!installment) throw new Error("Parcela não encontrada no workspace.");

      await tx.installment.update({
        where: { id: installmentId },
        data: {
          status: "SETTLED",
          settlementDate: extTx.occurredAt,
          settledAmountCents: extTx.amountCents,
        },
      });

      await tx.ledgerEntry.updateMany({ where: { workspaceId, externalTransactionId }, data: { installmentId } });

      revalidatePath("/movimentacoes");
      revalidatePath("/contas-a-pagar");
      revalidatePath("/contas-a-receber");
      revalidatePath("/relatorios");
      revalidatePath("/");
      return { success: true, reconciliation: rec };
    });
  } catch (error: any) {
    console.error("Erro ao conciliar transação:", error);
    return { success: false, error: error.message };
  }
}
