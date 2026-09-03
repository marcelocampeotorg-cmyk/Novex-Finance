import "server-only";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { getActiveMercadoPagoIntegrationForWorkspace } from "@/server/services/mercado-pago-integration";
import { parseMercadoPagoCredentials } from "@/lib/server/credentials-crypto";
import { MercadoPagoReportsClient, MercadoPagoRawTransaction, findMatchingSettlementReport } from "@/integrations/mercado-pago/reports-client";
import { MercadoPagoPaymentsClient } from "@/integrations/mercado-pago/payments-client";
import { categorizeTransactionDescription, reconcileWorkspace } from "@/server/services/reconciliation-service";
import { INTERNAL_WORKER_CONTEXT } from "@/server/internal-context";
import { selectMercadoPagoSyncWindow } from "@/domain/mercado-pago-sync-window";
import { validateAccessToken } from "@/integrations/mercado-pago/credentials-validator";

export async function getExternalTransactions(period: string = "MONTHLY") {
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
    } else if (period === "LAST_30_DAYS") {
      dateFilter = {
        gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        lte: now,
      };
    } else if (period === "PREVIOUS_MONTH") {
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
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
        rawProviderData: tx.rawProviderData,
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
          let existingTx = await tx.externalTransaction.findUnique({
            where: {
              workspaceId_source_externalId: {
                workspaceId,
                source,
                externalId: raw.externalId,
              },
            },
          });

          // Compatibilidade retroativa: se não encontrou pela chave composta, busca por SOURCE_ID simples para migração
          const rawSourceId = (raw.rawProviderData as any)?.SOURCE_ID;
          let duplicateLegacyTx: typeof existingTx = null;
          if (!existingTx && rawSourceId && rawSourceId !== raw.externalId) {
            const legacyTx = await tx.externalTransaction.findUnique({
              where: {
                workspaceId_source_externalId: {
                  workspaceId,
                  source,
                  externalId: rawSourceId,
                },
              },
            });
            if (legacyTx) {
              existingTx = legacyTx;
            }
          } else if (existingTx && rawSourceId && rawSourceId !== raw.externalId) {
            const legacyCandidate = await tx.externalTransaction.findUnique({
              where: {
                workspaceId_source_externalId: { workspaceId, source, externalId: rawSourceId },
              },
            });
            if (
              legacyCandidate && legacyCandidate.id !== existingTx.id &&
              legacyCandidate.direction === raw.direction &&
              Number(legacyCandidate.netAmountCents) === raw.netAmountCents &&
              legacyCandidate.occurredAt.getTime() === occurredDate.getTime()
            ) {
              duplicateLegacyTx = legacyCandidate;
            }
          }

          if (existingTx) {
            const isSettlement = Boolean(
              raw.rawProviderData &&
              ((raw.rawProviderData as any).SETTLEMENT_DATE || (raw.rawProviderData as any).SETTLEMENT_NET_AMOUNT || raw.type === "SETTLEMENT")
            );
            const isQuarantinedForUnconfirmed = existingTx.quarantinedAt !== null && existingTx.quarantineReason === "UNCONFIRMED_PAYMENTS_API_IMPORT";
            const shouldReactivate = isSettlement && isQuarantinedForUnconfirmed;

            const needsFinancialSync = isSettlement && (
              existingTx.externalId !== raw.externalId ||
              Number(existingTx.amountCents) !== raw.amountCents ||
              Number(existingTx.netAmountCents) !== raw.netAmountCents ||
              existingTx.direction !== raw.direction ||
              existingTx.occurredAt.getTime() !== occurredDate.getTime() ||
              shouldReactivate
            );

            await tx.externalTransaction.update({
              where: { id: existingTx.id },
              data: {
                externalId: raw.externalId,
                direction: isSettlement ? raw.direction : existingTx.direction,
                amountCents: isSettlement ? BigInt(raw.amountCents) : existingTx.amountCents,
                feeCents: isSettlement ? BigInt(raw.feeCents ?? 0) : existingTx.feeCents,
                netAmountCents: isSettlement ? BigInt(raw.netAmountCents) : existingTx.netAmountCents,
                occurredAt: isSettlement ? occurredDate : existingTx.occurredAt,
                type: isSettlement ? raw.type : existingTx.type,
                description: raw.description && raw.description !== "SETTLEMENT" ? raw.description : existingTx.description,
                counterpartName: raw.counterpartName || existingTx.counterpartName || duplicateLegacyTx?.counterpartName || null,
                counterpartDocument: raw.counterpartDocument || existingTx.counterpartDocument || null,
                txid: raw.txid || existingTx.txid || null,
                rawReference: raw.rawReference || existingTx.rawReference || null,
                rawProviderData: raw.rawProviderData ? (raw.rawProviderData as any) : existingTx.rawProviderData || undefined,
                rawEnrichmentData: shouldReactivate ? (existingTx.rawEnrichmentData || existingTx.rawProviderData || undefined) : undefined,
                quarantinedAt: shouldReactivate ? null : existingTx.quarantinedAt,
                quarantineReason: shouldReactivate ? null : existingTx.quarantineReason,
              },
            });

            if (duplicateLegacyTx && !duplicateLegacyTx.quarantinedAt) {
              const quarantinedAt = new Date();
              await tx.externalTransaction.update({
                where: { id: duplicateLegacyTx.id },
                data: {
                  quarantinedAt,
                  quarantineReason: "DUPLICATED_BY_COMPOSITE_SETTLEMENT_MIGRATION",
                },
              });
              await tx.ledgerEntry.updateMany({
                where: { externalTransactionId: duplicateLegacyTx.id },
                data: { excludedFromReports: true },
              });
              await tx.auditLog.create({
                data: {
                  workspaceId,
                  actorType: "SYSTEM",
                  actorId: "SYSTEM",
                  action: "LEGACY_SETTLEMENT_DUPLICATE_QUARANTINED",
                  entityType: "ExternalTransaction",
                  entityId: duplicateLegacyTx.id,
                  metadata: { canonicalTransactionId: existingTx.id, sourceId: rawSourceId },
                },
              });
            }

            if (shouldReactivate) {
              await tx.ledgerEntry.updateMany({
                where: { externalTransactionId: existingTx.id },
                data: {
                  direction: raw.direction,
                  amountCents: BigInt(raw.netAmountCents),
                  occurredAt: occurredDate,
                  excludedFromReports: false,
                },
              });

              await tx.auditLog.create({
                data: {
                  workspaceId,
                  actorType: "SYSTEM",
                  actorId: "SYSTEM",
                  action: "TRANSACTION_REACTIVATED_FROM_SETTLEMENT",
                  entityType: "ExternalTransaction",
                  entityId: existingTx.id,
                  metadata: {
                    externalId: raw.externalId,
                    reactivatedAt: new Date().toISOString(),
                    reason: "Transação comprovada oficialmente em relatório de liquidação do Mercado Pago",
                    settlementData: {
                      amountCents: raw.amountCents,
                      netAmountCents: raw.netAmountCents,
                      direction: raw.direction,
                    },
                  },
                },
              });
            } else if (needsFinancialSync) {
              await tx.ledgerEntry.updateMany({
                where: { externalTransactionId: existingTx.id },
                data: {
                  direction: raw.direction,
                  amountCents: BigInt(raw.netAmountCents),
                  occurredAt: occurredDate,
                },
              });

              await tx.auditLog.create({
                data: {
                  workspaceId,
                  actorType: "SYSTEM",
                  actorId: "SYSTEM",
                  action: "TRANSACTION_FINANCIAL_REPAIRED_FROM_SETTLEMENT",
                  entityType: "ExternalTransaction",
                  entityId: existingTx.id,
                  metadata: {
                    previous: {
                      amountCents: Number(existingTx.amountCents),
                      netAmountCents: Number(existingTx.netAmountCents),
                      direction: existingTx.direction,
                    },
                    repaired: {
                      amountCents: raw.amountCents,
                      netAmountCents: raw.netAmountCents,
                      direction: raw.direction,
                    },
                  },
                },
              });
            }

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
                sourceId: newTx.id,
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
 * Sincroniza pagamentos intradiários recentes via API oficial de Pagamentos do Mercado Pago.
 * Ingerido diretamente no Ledger para refletir recebimentos Pix em tempo real
 * sem aguardar a geração assíncrona do relatório em lote.
 */
export async function syncRecentMercadoPagoPayments(
  workspaceId: string,
  internalContext?: symbol,
) {
  try {
    const account = await getActiveMercadoPagoIntegrationForWorkspace(workspaceId);
    if (!account || !account.encryptedCredentials || !account.financialAccountId) {
      return { success: false, reason: "INTEGRATION_UNAVAILABLE" };
    }

    const { accessToken } = parseMercadoPagoCredentials(account.encryptedCredentials);
    const paymentsClient = new MercadoPagoPaymentsClient(accessToken);

    // Buscar últimos 3 dias para cobrir com segurança pagamentos intradiários recentes
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const recentPayments = await paymentsClient.searchRecentApprovedPayments({
      beginDate: threeDaysAgo,
      limit: 50,
    });

    if (recentPayments.length === 0) {
      return { success: true, insertedCount: 0, updatedCount: 0 };
    }

    const importResult = await importExternalTransactions(
      recentPayments,
      account.id,
      "MERCADO_PAGO_API",
      "MERCADO_PAGO",
      internalContext || INTERNAL_WORKER_CONTEXT,
      workspaceId,
      account.financialAccountId,
    );

    return importResult;
  } catch (error: any) {
    console.error("[syncRecentMercadoPagoPayments] Erro na sincronização de pagamentos recentes:", error);
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

  // Proteção Central contra Quotas e Loops (MAX_REPORTS, 429, 5xx): mesmo com force=true
  if (!syncRun) {
    const lastRun = await db.syncRun.findFirst({
      where: { workspaceId, integrationAccountId: account.id },
      orderBy: { createdAt: "desc" },
    });

    if (lastRun && lastRun.status === "FAILED") {
      const failureTime = (lastRun.finishedAt || lastRun.updatedAt || lastRun.createdAt).getTime();

      let consecutiveFailures = 0;
      const recentRuns = await db.syncRun.findMany({
        where: { workspaceId, integrationAccountId: account.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { status: true },
      });
      for (const r of recentRuns) {
        if (r.status === "FAILED") consecutiveFailures++;
        else break;
      }

      const isMaxReports = Boolean(lastRun.errorMessage && lastRun.errorMessage.includes("Max number of reports"));
      const isRateLimit = Boolean(lastRun.errorMessage && (lastRun.errorMessage.includes("429") || lastRun.errorMessage.includes("Rate limit")));

      let cooldownMs: number;
      if (isMaxReports || isRateLimit) {
        cooldownMs = consecutiveFailures >= 3 ? 60 * 60 * 1000 : (consecutiveFailures === 2 ? 30 * 60 * 1000 : 15 * 60 * 1000);
      } else if (consecutiveFailures >= 3) {
        cooldownMs = 30 * 60 * 1000;
      } else if (consecutiveFailures === 2) {
        cooldownMs = 15 * 60 * 1000;
      } else {
        cooldownMs = 5 * 60 * 1000;
      }

      const timeSinceFailure = Date.now() - failureTime;

      if (timeSinceFailure < cooldownMs && !isForce) {
        const remainingSec = Math.ceil((cooldownMs - timeSinceFailure) / 1000);
        return {
          success: false,
          status: "FAILED",
          message: `Aguardando cooldown de proteção da API (${remainingSec}s restantes) após erro recente no provedor.`,
          error: lastRun.errorMessage || "COOLDOWN_ACTIVE",
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          autoMatchedCount: 0,
        };
      }
    }

    // Rate limit central de 180 segundos mesmo com isForce para evitar tempestades de chamadas e preservar cota
    if (isForce && account.lastSyncAt) {
      const now = new Date();
      const diffInSeconds = (now.getTime() - account.lastSyncAt.getTime()) / 1000;
      if (diffInSeconds < 180) {
        return {
          success: true,
          cached: true,
          message: "Sincronização recente (menos de 3 min). Retornando dados locais para preservar cota.",
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          autoMatchedCount: 0,
        };
      }
    }

    // Cache de 60 minutos (cadência horária) para chamadas automáticas/não forçadas
    const CACHE_MINUTES = 60;
    if (!isForce && account.lastSyncAt && account.historyBackfillStatus === "COMPLETE") {
      const now = new Date();
      const diffInMinutes = (now.getTime() - account.lastSyncAt.getTime()) / (1000 * 60);
      if (diffInMinutes < CACHE_MINUTES) {
        return {
          success: true,
          cached: true,
          message: "Sincronização recente (menos de 1 hora). Retornando dados locais.",
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          autoMatchedCount: 0,
        };
      }
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
    try {
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
    } catch (createErr: any) {
      if (createErr.code === "P2002" || String(createErr.message).includes("unique_active_sync_run_per_integration")) {
        const activeRun = await db.syncRun.findFirst({
          where: {
            workspaceId,
            integrationAccountId: account.id,
            status: "PROCESSING",
          },
          orderBy: { createdAt: "desc" },
        });
        if (activeRun) {
          syncRun = activeRun;
        } else {
          throw createErr;
        }
      } else {
        throw createErr;
      }
    }
  }

  try {
    const credentials = parseMercadoPagoCredentials(account.encryptedCredentials!);
    const client = new MercadoPagoReportsClient(credentials.accessToken);

    // 1. Solicitar geração assíncrona do Settlement Report se ainda não tiver ID remoto
    if (!syncRun.remoteTaskId) {
      // Atomic claim com lease de 2 minutos baseado em updatedAt (preservando startedAt imutável)
      const LEASE_MS = 2 * 60 * 1000;
      const nowClaim = new Date();
      const staleClaimThreshold = new Date(nowClaim.getTime() - LEASE_MS);

      const claimRes = await db.syncRun.updateMany({
        where: {
          id: syncRun.id,
          remoteTaskId: null,
          OR: [
            { errorCode: { not: "REQUESTING_REPORT" } },
            { errorCode: "REQUESTING_REPORT", updatedAt: { lt: staleClaimThreshold } },
          ],
        },
        data: {
          errorCode: "REQUESTING_REPORT",
        },
      });

      if (claimRes.count === 0) {
        // Outro processo concorrente já está disparando a solicitação e o lease está ativo
        console.log(`[TransactionsService] Solicitação remota já reivindicada por processo concorrente ativo para SyncRun ${syncRun.id}.`);
        return {
          success: true,
          status: "PROCESSING",
          message: "Solicitação de relatório remota já em andamento por outro processo concorrente.",
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          autoMatchedCount: 0,
        };
      }

      // 1.1 Recuperação de resultado remoto ambíguo: verificar se já existe relatório correspondente (processado ou em processamento) antes de emitir POST
      let remoteLookupFailed = false;
      try {
        const listRes = await fetch("https://api.mercadopago.com/v1/account/settlement_report/list", {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        });
        if (listRes.ok) {
          const list = await listRes.json();
          const existingReport = findMatchingSettlementReport(list, beginDate, endDate);

          if (existingReport) {
            const isReady = existingReport.status === "processed" && Boolean(existingReport.file_name);
            await db.syncRun.update({
              where: { id: syncRun.id },
              data: {
                remoteTaskId: String(existingReport.id),
                remoteFileName: isReady ? existingReport.file_name : null,
                remoteReportId: String(existingReport.id),
                errorCode: runPurpose,
              },
            });
            syncRun.remoteTaskId = String(existingReport.id);
            syncRun.remoteFileName = isReady ? existingReport.file_name : null;
            syncRun.remoteReportId = String(existingReport.id);

            if (!isReady) {
              return {
                success: true,
                status: "PROCESSING",
                message: "Relatório remoto já solicitado em processamento no Mercado Pago. Aguardando conclusão.",
                insertedCount: 0,
                updatedCount: 0,
                skippedCount: 0,
                autoMatchedCount: 0,
              };
            }
          }
        } else {
          remoteLookupFailed = true;
        }
      } catch (ambiguousErr) {
        remoteLookupFailed = true;
        console.warn("[TransactionsService] Verificação prévia de relatório existente falhou:", ambiguousErr);
      }

      // Fail-closed em recuperação ambígua: se a consulta remota falhou, não disparamos novo POST às cegas
      if (remoteLookupFailed && !syncRun.remoteTaskId) {
        return {
          success: true,
          status: "PROCESSING",
          message: "Falha de comunicação temporária ao verificar relatórios no Mercado Pago. Aguardando próximo ciclo seguro sem emissão de POST duplicado.",
          insertedCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          autoMatchedCount: 0,
        };
      }

      // Se após a verificação prévia ainda não tiver remoteTaskId, emite a chamada POST oficial
      if (!syncRun.remoteTaskId) {
        let requestRes;
        try {
          requestRes = await client.requestSettlementReport(beginDate, endDate);
        } catch (reqErr: any) {
          await db.syncRun.update({
            where: { id: syncRun.id },
            data: { errorCode: runPurpose },
          });
          throw reqErr;
        }

        if (!requestRes.success) {
          await db.syncRun.update({
            where: { id: syncRun.id },
            data: { errorCode: runPurpose },
          });
          throw new Error(requestRes.error || "Falha ao solicitar relatório de liquidação no Mercado Pago.");
        }

        if (requestRes.fileName && requestRes.status === "READY") {
          await db.syncRun.update({
            where: { id: syncRun.id },
            data: {
              remoteTaskId: requestRes.taskId || "DIRECT",
              remoteFileName: requestRes.fileName,
              remoteReportId: requestRes.taskId || "DIRECT",
              errorCode: runPurpose,
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
              errorCode: runPurpose,
            },
          });
          syncRun.remoteTaskId = requestRes.taskId;
        }
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
    } else if (period === "LAST_30_DAYS") {
      dateFilter = {
        gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        lte: now,
      };
    } else if (period === "PREVIOUS_MONTH") {
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0),
        lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
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

export async function reconcileWithNewItem(data: {
  externalTransactionId: string;
  title: string;
  categoryName: string;
  contactName?: string;
  description?: string;
}) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    return await db.$transaction(async (tx) => {
      const extTx = await tx.externalTransaction.findFirst({
        where: {
          id: data.externalTransactionId,
          workspaceId,
          reconciliations: { none: { status: "MATCHED" } },
        },
      });
      if (!extTx) throw new Error("Movimentação inválida ou já conciliada.");

      const direction: "PAYABLE" | "RECEIVABLE" = extTx.direction === "DEBIT" ? "PAYABLE" : "RECEIVABLE";

      // 1. Localizar ou criar contato
      let finalContactId: string | null = null;
      const contactName = (data.contactName || extTx.counterpartName || "").trim();
      if (contactName) {
        let contact = await tx.contact.findFirst({
          where: { workspaceId, name: contactName },
        });
        if (!contact) {
          contact = await tx.contact.create({
            data: {
              workspaceId,
              name: contactName,
              type: "PERSON",
              isPayee: direction === "PAYABLE",
              isDebtor: direction === "RECEIVABLE",
            },
          });
        }
        finalContactId = contact.id;
      }

      // 2. Localizar ou criar categoria
      let categoryId: string | null = null;
      const catName = (data.categoryName || (direction === "RECEIVABLE" ? "Serviços Prestados" : "Outras Despesas")).trim();
      let category = await tx.category.findFirst({
        where: { workspaceId, name: catName },
      });
      if (!category) {
        category = await tx.category.create({
          data: {
            workspaceId,
            name: catName,
            direction: direction === "PAYABLE" ? "EXPENSE" : "INCOME",
            colorToken: "#00F0FF",
          },
        });
      }
      categoryId = category.id;

      // 3. Criar FinancialItem já quitado
      const title = data.title.trim() || (direction === "RECEIVABLE" ? "Recebimento Pix" : "Pagamento");
      const financialItem = await tx.financialItem.create({
        data: {
          workspaceId,
          direction,
          kind: "ONE_TIME",
          title,
          description: data.description || extTx.description,
          contactId: finalContactId,
          categoryId,
          totalAmountCents: extTx.amountCents,
          startDate: extTx.occurredAt,
          status: "ACTIVE",
        },
      });

      // 4. Criar Installment já liquidado
      const uniqueSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      const installment = await tx.installment.create({
        data: {
          financialItemId: financialItem.id,
          sequence: 1,
          amountCents: extTx.amountCents,
          settledAmountCents: extTx.amountCents,
          dueDate: extTx.occurredAt,
          status: "SETTLED",
          settlementDate: extTx.occurredAt,
          uniqueReference: `NOVEX-${direction.slice(0, 3)}-AUTO-${uniqueSuffix}-1`,
        },
      });

      // 5. Criar registro de conciliação MATCHED
      const reconciliation = await tx.reconciliation.create({
        data: {
          workspaceId,
          externalTransactionId: extTx.id,
          installmentId: installment.id,
          status: "MATCHED",
          score: 100,
          reasons: ["Conciliação direta manual como nova receita/despesa"],
          matchedBy: "USER",
          matchedAt: new Date(),
        },
      });

      // 6. Atualizar LedgerEntry existente
      await tx.ledgerEntry.updateMany({
        where: { workspaceId, externalTransactionId: extTx.id },
        data: {
          installmentId: installment.id,
          categoryId,
        },
      });

      revalidatePath("/movimentacoes");
      revalidatePath("/contas-a-pagar");
      revalidatePath("/contas-a-receber");
      revalidatePath("/relatorios");
      revalidatePath("/");

      return { success: true, reconciliation };
    });
  } catch (error: any) {
    console.error("Erro ao conciliar movimentação com novo item:", error);
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

    // 1. Buscar apenas transações ativas elegíveis que ainda precisam de enriquecimento
    const txsToEnrich = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        integrationAccountId: account.id,
        quarantinedAt: null,
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
      // 2. Extrair o ID oficial do provedor (SOURCE_ID / EXTERNAL_ID original) e NUNCA usar chave interna composta
      const rawSourceId = String((tx.rawProviderData as any)?.SOURCE_ID || (tx.rawProviderData as any)?.EXTERNAL_ID || tx.externalId || "").trim();
      const isNumericPaymentId = /^\d{5,18}$/.test(rawSourceId);
      const isTaxOrYield = tx.description?.toLowerCase().includes("imposto") ||
        tx.description?.toLowerCase().includes("retenção") ||
        tx.description?.toLowerCase().includes("rendimento") ||
        tx.description?.toLowerCase().includes("tarifa");

      let pData: any = null;

      // Somente consultar a Payments API se o ID for comprovadamente um identificador de pagamento numérico válido e não for taxa/imposto
      if (isNumericPaymentId && !isTaxOrYield) {
        // Pausa preventiva de 100ms entre requisições para conformidade estrita com a política de rate limit
        await new Promise((resolve) => setTimeout(resolve, 100));
        const rawPayment = await paymentsClient.getPaymentDetails(rawSourceId);
        if (rawPayment && (rawPayment.status === "approved" || rawPayment.status === "accredited")) {
          pData = paymentsClient.mapPaymentToEnrichmentData(rawPayment);
        }
      }

      if (pData) {
        await db.externalTransaction.update({
          where: { id: tx.id },
          data: {
            description: pData.description && pData.description !== "SETTLEMENT" ? pData.description : tx.description,
            counterpartName: pData.counterpartName || tx.counterpartName || null,
            counterpartDocument: pData.counterpartDocument || tx.counterpartDocument || null,
            txid: pData.txid || tx.txid || null,
            rawReference: pData.rawReference || tx.rawReference || null,
            rawEnrichmentData: pData.rawEnrichmentData as any,
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
      } else {
        // Se não for enriquecível pela Payments API (ex: saques, taxas, rendimentos), auto-categoriza pela descrição do Settlement
        const categoryName = await categorizeTransactionDescription(tx.description, workspaceId);
        if (categoryName && categoryName !== "Não categorizada") {
          const cat = await db.category.findFirst({ where: { workspaceId, name: categoryName } });
          if (cat) {
            await db.ledgerEntry.updateMany({
              where: { externalTransactionId: tx.id, categoryId: null },
              data: { categoryId: cat.id },
            });
          }
        }
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
