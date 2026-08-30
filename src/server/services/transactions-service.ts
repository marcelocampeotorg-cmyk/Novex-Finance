import "server-only";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { getActiveMercadoPagoIntegrationForWorkspace } from "@/server/services/mercado-pago-integration";
import { parseMercadoPagoCredentials } from "@/lib/server/credentials-crypto";
import { MercadoPagoReportsClient, MercadoPagoRawTransaction } from "@/integrations/mercado-pago/reports-client";
import { MercadoPagoPaymentsClient } from "@/integrations/mercado-pago/payments-client";
import { categorizeTransactionDescription, reconcileWorkspace } from "@/server/services/reconciliation-service";
import { INTERNAL_WORKER_CONTEXT } from "@/server/internal-context";
import { selectMercadoPagoSyncWindow } from "@/domain/mercado-pago-sync-window";
import { validateAccessToken } from "@/integrations/mercado-pago/credentials-validator";

export async function getExternalTransactions(period: string = "MONTHLY") {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { financeMode: true } });

    const now = new Date();
    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;

    if (period === "DAILY" || period === "TODAY") {
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    } else if (period === "WEEKLY") {
      dateFilter = {
        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        lte: now,
      };
    } else if (period === "BIWEEKLY") {
      dateFilter = {
        gte: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        lte: now,
      };
    } else if (period === "YEARLY") {
      dateFilter = {
        gte: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    } else if (period === "ALL") {
      dateFilter = undefined;
    } else {
      // Default to MONTHLY
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    }

    const txs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        source: workspace?.financeMode === "MANUAL" ? "MANUAL_ADJUSTMENT" : undefined,
        quarantinedAt: null,
        occurredAt: dateFilter,
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
        source: tx.source,
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
  financialAccountId?: string | null,
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
                description: raw.description && raw.description !== "SETTLEMENT" ? raw.description : existingTx.description,
                counterpartName: raw.counterpartName || existingTx.counterpartName || null,
                counterpartDocument: raw.counterpartDocument || existingTx.counterpartDocument || null,
                txid: raw.txid || existingTx.txid || null,
                rawReference: raw.rawReference || existingTx.rawReference || null,
                rawProviderData: raw.rawProviderData ? (raw.rawProviderData as any) : existingTx.rawProviderData || undefined,
              },
            });

            // Auto-categorizar se categoria no ledgerEntry for nula
            const categoryName = await categorizeTransactionDescription(raw.description, workspaceId);
            if (categoryName && categoryName !== "Não categorizada") {
              const cat = await tx.category.findFirst({ where: { workspaceId, name: categoryName } });
              if (cat) {
                await tx.ledgerEntry.updateMany({
                  where: { externalTransactionId: existingTx.id, categoryId: null },
                  data: { categoryId: cat.id },
                });
              }
            }
            updatedCount++;
          } else {
            const newTx = await tx.externalTransaction.create({
              data: {
                workspaceId,
                integrationAccountId: integrationAccountId || null,
                financialAccountId: financialAccountId || null,
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
                rawProviderData: raw.rawProviderData ? (raw.rawProviderData as any) : undefined,
              },
            });

            // Atribuir categoria automática
            const categoryName = await categorizeTransactionDescription(raw.description, workspaceId);
            let categoryId: string | null = null;
            if (categoryName && categoryName !== "Não categorizada") {
              const cat = await tx.category.findFirst({ where: { workspaceId, name: categoryName } });
              if (cat) categoryId = cat.id;
            }

            // Regra 3: Fato financeiro nasce na ingestão -> cria LedgerEntry no mesmo momento (1x1 atômico)
            await tx.ledgerEntry.create({
              data: {
                workspaceId,
                financialAccountId: newTx.financialAccountId,
                externalTransactionId: newTx.id,
                direction: newTx.direction,
                amountCents: newTx.netAmountCents, // Regra 8: Usa impacto líquido oficial netAmountCents
                occurredAt: newTx.occurredAt,
                sourceType: newTx.source,
                sourceId: newTx.externalId,
                categoryId,
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
      ? await reconcileWorkspace(INTERNAL_WORKER_CONTEXT, workspaceId)
      : await reconcileWorkspace();

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
export async function continueMercadoPagoSyncRun(
  opts?: { force?: boolean; syncRunId?: string; integrationAccountId?: string | null; internalContext?: symbol; workspaceId?: string } | boolean
) {
  const isForce = typeof opts === "boolean" ? opts : opts?.force ?? false;
  const syncRunId = typeof opts === "object" ? opts?.syncRunId : undefined;
  const targetIntegrationId = typeof opts === "object" ? opts?.integrationAccountId : undefined;
  const isInternalWorker = typeof opts === "object" && opts.internalContext === INTERNAL_WORKER_CONTEXT;

  let workspaceId: string;
  let account: any;

  if (targetIntegrationId) {
    if (!isInternalWorker) throw new Error("Acesso interno do worker inválido.");
    const acc = await db.integrationAccount.findUnique({ where: { id: targetIntegrationId } });
    if (!acc) throw new Error("Conta de integração não encontrada.");
    workspaceId = acc.workspaceId;
    account = acc;
  } else if (isInternalWorker && typeof opts === "object" && opts.workspaceId) {
    workspaceId = opts.workspaceId;
    account = await getActiveMercadoPagoIntegrationForWorkspace(workspaceId);
  } else {
    const auth = await requireAuthenticatedWorkspace();
    workspaceId = auth.workspaceId;
    account = await getActiveMercadoPagoIntegrationForWorkspace(workspaceId);
  }
  const workspaceMode = await db.workspace.findUnique({ where: { id: workspaceId }, select: { financeMode: true } });
  if (workspaceMode?.financeMode !== "HYBRID") throw new Error("A sincronização Mercado Pago exige o modo Híbrido.");

  if (!account.providerAccountCreatedAt && account.encryptedCredentials) {
    const identityCredentials = parseMercadoPagoCredentials(account.encryptedCredentials);
    const identity = await validateAccessToken(identityCredentials.accessToken);
    if (identity.valid && identity.accountCreatedAt) {
      account = await db.integrationAccount.update({
        where: { id: account.id },
        data: { providerAccountCreatedAt: new Date(identity.accountCreatedAt) },
      });
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

  // Cache de 5 minutos: impede criação de NOVO sync, mas NUNCA impede continuação de um existente
  const CACHE_MINUTES = 5;
  if (!syncRun && !isForce && account.lastSyncAt && account.historyBackfillStatus === "COMPLETE") {
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

  const now = new Date();
  let beginDate: Date;
  let endDate: Date;
  let runPurpose: "INITIAL" | "BACKFILL" | "INCREMENTAL" = "INITIAL";
  if (syncRun) {
    beginDate = syncRun.beginDate;
    endDate = syncRun.endDate;
  } else {
    const selected = selectMercadoPagoSyncWindow({ now, coverageStart: account.coverageStart, coverageEnd: account.coverageEnd, historyBackfillStatus: account.historyBackfillStatus, providerAccountCreatedAt: account.providerAccountCreatedAt });
    beginDate = selected.beginDate;
    endDate = selected.endDate;
    runPurpose = selected.purpose;
  }

  if (beginDate >= endDate) {
    await db.integrationAccount.update({ where: { id: account.id }, data: { historyBackfillStatus: "COMPLETE" } });
    return { success: true, status: "SUCCESS", message: "Cobertura histórica máxima concluída.", insertedCount: 0, updatedCount: 0, skippedCount: 0, autoMatchedCount: 0 };
  }

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
        errorCode: runPurpose,
      },
    });
  }

  try {
    const credentials = parseMercadoPagoCredentials(account.encryptedCredentials!);
    const client = new MercadoPagoReportsClient(credentials.accessToken);
    const paymentsClient = new MercadoPagoPaymentsClient(credentials.accessToken);

    // 1. Sincronização em Tempo Real de Pagamentos Recentes (/v1/payments/search)
    try {
      const livePayments = await paymentsClient.searchLivePayments({ limit: 100, userId: account.externalAccountId || undefined });
      if (livePayments.length > 0) {
        await importExternalTransactions(
          livePayments,
          account.id,
          "MERCADO_PAGO_API",
          "MERCADO_PAGO",
          INTERNAL_WORKER_CONTEXT,
          workspaceId,
          account.financialAccountId,
        );
      }
    } catch (e: any) {
      console.warn("[TransactionsService] Erro não bloqueante ao consultar live payments:", e.message);
    }

    // 2. Solicitar geração assíncrona do Settlement Report se ainda não tiver ID remoto
    if (!syncRun.remoteTaskId) {
      const requestRes = await client.requestSettlementReport(beginDate, endDate);
      if (!requestRes.success) {
        throw new Error(requestRes.error || "Falha ao solicitar relatório de liquidação no Mercado Pago.");
      }
      if (requestRes.fileName && requestRes.status === "READY") {
        await db.syncRun.update({
          where: { id: syncRun.id },
          data: {
            remoteTaskId: requestRes.taskId || "DIRECT",
            remoteFileName: requestRes.fileName,
            remoteReportId: requestRes.taskId || "DIRECT",
          },
        });
        syncRun.remoteTaskId = requestRes.taskId || "DIRECT";
        syncRun.remoteFileName = requestRes.fileName;
        syncRun.remoteReportId = requestRes.taskId || "DIRECT";
      } else if (requestRes.taskId) {
        await db.syncRun.update({
          where: { id: syncRun.id },
          data: {
            remoteTaskId: requestRes.taskId,
          },
        });
        syncRun.remoteTaskId = requestRes.taskId;
      }
    }

    // 3. Continuar task criada para este SyncRun ou usar o arquivo já disponível
    let fileName = syncRun.remoteFileName;
    if (!fileName) {
      const task = await client.getSettlementReportTask(syncRun.remoteTaskId!);
      if (task.status === "FAILED") throw new Error("Task de relatório falhou no Mercado Pago.");
      if (task.status !== "READY" || !task.fileName || !task.reportId) {
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
      fileName = task.fileName;
      await db.syncRun.update({ where: { id: syncRun.id }, data: { remoteReportId: task.reportId, remoteFileName: task.fileName } });
    }

    // 4. Efetuar download do relatório pelo file_name oficial e parsear movimentações
    const csvContent = await client.downloadSettlementReport(fileName);

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
      account.financialAccountId,
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

    // Item 4: Fechamento bem-sucedido (SUCCESS) atualiza lastSyncAt e horizonte de cobertura
    if (finalRunStatus === "SUCCESS") {
      const reachedBeginning = !!account.providerAccountCreatedAt && beginDate.getTime() <= account.providerAccountCreatedAt.getTime() + 1000;
      const historyBackfillStatus = reachedBeginning
        ? "COMPLETE"
        : account.providerAccountCreatedAt
          ? "IN_PROGRESS"
          : "LIMIT_UNKNOWN";
      await db.integrationAccount.update({
        where: { id: account.id },
        data: {
          lastSyncAt: new Date(),
          firstImportedAt: account.firstImportedAt || beginDate,
          coverageStart: !account.coverageStart || beginDate < account.coverageStart ? beginDate : account.coverageStart,
          coverageEnd: !account.coverageEnd || endDate > account.coverageEnd ? endDate : account.coverageEnd,
          historyBackfillStatus,
        },
      });

      // Atualizar saldo apurado da FinancialAccount associada
      if (account.financialAccountId) {
        const allTx = await db.externalTransaction.findMany({
          where: { workspaceId, integrationAccountId: account.id, quarantinedAt: null },
          select: { direction: true, netAmountCents: true },
        });
        let calculatedBalance = 0;
        for (const t of allTx) {
          calculatedBalance += (t.direction === "CREDIT" ? Number(t.netAmountCents) : -Number(t.netAmountCents));
        }
        await db.financialAccount.update({
          where: { id: account.financialAccountId },
          data: {
            officialBalanceCents: BigInt(calculatedBalance),
            officialBalanceStatus: "CONFIRMED",
            officialBalanceAt: new Date(),
          },
        });
      }
    }

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

    const externalTransaction = await db.externalTransaction.findFirst({ where: { id: externalTransactionId, workspaceId } });
    if (!externalTransaction) return { success: false, error: "Movimentação não encontrada no workspace." };
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
    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;

    if (period === "DAILY" || period === "TODAY") {
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    } else if (period === "WEEKLY") {
      dateFilter = {
        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        lte: now,
      };
    } else if (period === "BIWEEKLY") {
      dateFilter = {
        gte: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        lte: now,
      };
    } else if (period === "YEARLY") {
      dateFilter = {
        gte: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    } else if (period === "ALL") {
      dateFilter = undefined;
    } else {
      // Default to MONTHLY
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    }

    const txs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        quarantinedAt: null,
        occurredAt: dateFilter,
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
      const extTx = await tx.externalTransaction.findFirst({
        where: { id: externalTransactionId, workspaceId, reconciliations: { none: { status: "MATCHED" } } },
      });
      const installment = await tx.installment.findFirst({
        where: { id: installmentId, financialItem: { workspaceId, deletedAt: null } }, include: { financialItem: true },
      });
      if (!extTx || !installment) throw new Error("Movimentação/parcela inválida ou já conciliada.");
      const expectedDirection = installment.financialItem.direction === "PAYABLE" ? "DEBIT" : "CREDIT";
      if (extTx.direction !== expectedDirection) throw new Error("Direção incompatível.");
      const remaining = installment.amountCents - installment.settledAmountCents;
      if (remaining <= 0n || installment.status === "SETTLED") throw new Error("Parcela já liquidada.");
      if (extTx.amountCents !== remaining) throw new Error("Valor divergente exige decisão explícita; conciliação automática/manual bloqueada.");

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

      const newSettled = installment.settledAmountCents + extTx.amountCents;

      await tx.installment.update({
        where: { id: installmentId },
        data: {
          status: newSettled >= installment.amountCents ? "SETTLED" : "PARTIAL",
          settlementDate: extTx.occurredAt,
          settledAmountCents: newSettled,
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

/**
 * Enriquece retroativamente todas as transações importadas do Mercado Pago no workspace
 * com nomes reais de pagadores, bancos, descrições e auto-categorização.
 */
export async function enrichAllMercadoPagoTransactions(internalContext?: symbol, targetWorkspaceId?: string) {
  try {
    const workspaceId = internalContext === INTERNAL_WORKER_CONTEXT && targetWorkspaceId
      ? targetWorkspaceId
      : (await requireAuthenticatedWorkspace()).workspaceId;

    const account = await db.integrationAccount.findFirst({
      where: { workspaceId, provider: "MERCADO_PAGO", isActive: true },
    });
    if (!account || !account.encryptedCredentials) {
      return { success: false, error: "Nenhuma conta Mercado Pago ativa encontrada." };
    }

    const credentials = parseMercadoPagoCredentials(account.encryptedCredentials);
    const paymentsClient = new MercadoPagoPaymentsClient(credentials.accessToken);

    // 1. Buscar live payments recentes
    const livePayments = await paymentsClient.searchLivePayments({ limit: 100, userId: account.externalAccountId || undefined });
    const paymentMap = new Map(livePayments.map((p) => [p.externalId, p]));

    // 2. Buscar apenas transações que ainda precisam de enriquecimento
    const txsToEnrich = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        integrationAccountId: account.id,
        OR: [
          { description: "SETTLEMENT" },
          { counterpartName: null },
        ],
      },
      take: 20, // Lote seguro para respeitar rate limits da API
    });

    if (txsToEnrich.length === 0) {
      return { success: true, enrichedCount: 0 };
    }

    let enrichedCount = 0;
    for (const tx of txsToEnrich) {
      let pData = paymentMap.get(tx.externalId);
      if (!pData) {
        // Pausa preventiva de 100ms entre requisições para conformidade estrita com a política de rate limit
        await new Promise((resolve) => setTimeout(resolve, 100));
        const rawPayment = await paymentsClient.getPaymentDetails(tx.externalId);
        if (rawPayment && (rawPayment.status === "approved" || rawPayment.status === "accredited")) {
          pData = paymentsClient.mapPaymentToRawTransaction(rawPayment, account.externalAccountId || undefined);
        }
      }

      if (pData) {
        await db.externalTransaction.update({
          where: { id: tx.id },
          data: {
            description: pData.description && pData.description !== "SETTLEMENT" ? pData.description : tx.description,
            counterpartName: pData.counterpartName || tx.counterpartName || null,
            txid: pData.txid || tx.txid || null,
            rawReference: pData.rawReference || tx.rawReference || null,
            rawProviderData: pData.rawProviderData as any,
          },
        });

        const categoryName = await categorizeTransactionDescription(pData.description, workspaceId);
        if (categoryName && categoryName !== "Não categorizada") {
          const cat = await db.category.findFirst({ where: { workspaceId, name: categoryName } });
          if (cat) {
            await db.ledgerEntry.updateMany({
              where: { externalTransactionId: tx.id, categoryId: null },
              data: { categoryId: cat.id },
            });
          }
        }
        enrichedCount++;
      }
    }

    revalidatePath("/movimentacoes");
    revalidatePath("/relatorios");
    revalidatePath("/");

    return { success: true, enrichedCount };
  } catch (error: any) {
    console.error("Erro ao enriquecer transações do Mercado Pago:", error);
    return { success: false, error: error.message || String(error) };
  }
}

