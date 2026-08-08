"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { MercadoPagoRawTransaction, MercadoPagoReportsClient } from "@/integrations/mercado-pago/reports-client";
import { categorizeTransactionDescription, runAutomaticReconciliationEngine } from "@/server/actions/reconciliation";

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
      const category = await categorizeTransactionDescription(tx.description);
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
    return [];
  }
}

/**
 * Importar lote de movimentações externas (com deduplicação estrita)
 */
export async function importExternalTransactions(rawTransactions: MercadoPagoRawTransaction[]) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    // Obter ou registrar conta de integração padrão do Mercado Pago
    let integrationAccount = await db.integrationAccount.findFirst({
      where: { workspaceId, provider: "MERCADO_PAGO" },
    });

    if (!integrationAccount) {
      integrationAccount = await db.integrationAccount.create({
        data: {
          workspaceId,
          provider: "MERCADO_PAGO",
          environment: "SANDBOX",
          displayName: "Mercado Pago Principal",
          status: "CONNECTED",
        },
      });
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const raw of rawTransactions) {
      const occurredDate = new Date(raw.occurredAt);

      try {
        await db.externalTransaction.upsert({
          where: {
            integrationAccountId_provider_externalId: {
              integrationAccountId: integrationAccount.id,
              provider: "MERCADO_PAGO",
              externalId: raw.externalId,
            },
          },
          create: {
            workspaceId,
            integrationAccountId: integrationAccount.id,
            provider: "MERCADO_PAGO",
            externalId: raw.externalId,
            direction: raw.direction,
            type: raw.type,
            status: "APPROVED",
            amountCents: BigInt(raw.amountCents),
            feeCents: BigInt(raw.feeCents || 0),
            netAmountCents: BigInt(raw.netAmountCents || raw.amountCents),
            occurredAt: occurredDate,
            counterpartName: raw.counterpartName || null,
            counterpartDocument: raw.counterpartDocument || null,
            txid: raw.txid || null,
            description: raw.description,
            rawReference: raw.rawReference || null,
          },
          update: {
            description: raw.description,
            counterpartName: raw.counterpartName || null,
            counterpartDocument: raw.counterpartDocument || null,
          },
        });
        insertedCount++;
      } catch (e) {
        skippedCount++;
      }
    }

    // Atualizar data da última sincronização
    await db.integrationAccount.update({
      where: { id: integrationAccount.id },
      data: { lastSyncAt: new Date() },
    });

    // Disparar motor de conciliação automática após importação
    const reconResult = await runAutomaticReconciliationEngine();

    revalidatePath("/movimentacoes");
    revalidatePath("/relatorios");
    revalidatePath("/");

    return {
      success: true,
      insertedCount,
      skippedCount,
      autoMatchedCount: reconResult.autoMatchedCount || 0,
    };
  } catch (error: any) {
    console.error("Erro na importação de movimentações:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar extrato via API do Mercado Pago e executar importação
 */
export async function syncMercadoPagoStatement() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const account = await db.integrationAccount.findFirst({
      where: { workspaceId, provider: "MERCADO_PAGO" },
    });

    // Instanciar cliente com o token configurado (ou demo fallback)
    const client = new MercadoPagoReportsClient();
    const rawTxs = await client.fetchAccountStatement();

    return await importExternalTransactions(rawTxs);
  } catch (error: any) {
    console.error("Erro na sincronização de extrato do Mercado Pago:", error);
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
    return {
      totalCount: 0,
      matchedCount: 0,
      suggestedCount: 0,
      unmatchedCount: 0,
      totalCreditCents: 0,
      totalDebitCents: 0,
      totalFeeCents: 0,
      reconciliationPercentage: 0,
    };
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

      await tx.installment.update({
        where: { id: installmentId },
        data: {
          status: "SETTLED",
          settlementDate: extTx ? extTx.occurredAt : new Date(),
          settledAmountCents: extTx ? extTx.amountCents : undefined,
        },
      });

      if (extTx) {
        await tx.ledgerEntry.create({
          data: {
            workspaceId,
            externalTransactionId,
            installmentId,
            direction: extTx.direction,
            amountCents: extTx.amountCents,
            occurredAt: extTx.occurredAt,
            sourceType: "CONCILIATION",
            sourceId: rec.id,
          },
        });
      }

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
