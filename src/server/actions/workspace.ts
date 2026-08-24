"use server";

import { db } from "@/server/db";
import { BalanceSummaryMock } from "@/types";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export async function getWorkspaceSummary(): Promise<BalanceSummaryMock> {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const now = new Date();
    const installments = await db.installment.findMany({
      where: {
        financialItem: { workspaceId, deletedAt: null },
      },
      include: { financialItem: true },
    });

    let totalPayableMonthCents = 0;
    let totalReceivableMonthCents = 0;
    let totalOverdueCents = 0;

    installments.forEach((inst: any) => {
      const remainingCents = Number(inst.amountCents - inst.settledAmountCents);
      if (inst.financialItem.direction === "PAYABLE") {
        if (inst.status !== "SETTLED" && inst.status !== "CANCELED") {
          totalPayableMonthCents += remainingCents;
          if (inst.dueDate < now) totalOverdueCents += remainingCents;
        }
      } else {
        if (inst.status !== "SETTLED" && inst.status !== "CANCELED") {
          totalReceivableMonthCents += remainingCents;
        }
      }
    });

    const unmatchesCount = await db.externalTransaction.count({
      where: { workspaceId, reconciliations: { none: { status: "MATCHED" } } },
    });

    const mpIntegration = await db.integrationAccount.findFirst({
      where: { workspaceId, provider: "MERCADO_PAGO" },
    });

    let currentBalanceCents = 0;
    let syncSource: "SINCRONIZADO" | "PENDENTE" | "DESCONECTADO" | "CALCULADO" = "CALCULADO";
    let accountDisplayName = "Conta Local";
    let lastSyncAt = new Date().toISOString();
    let isOutdated = false;

    if (mpIntegration) {
      accountDisplayName = mpIntegration.displayName || "Mercado Pago";
      
      if (mpIntegration.status !== "CONNECTED") {
        syncSource = "DESCONECTADO";
        isOutdated = true;
      } else if (mpIntegration.lastValidationErrorCode) {
        syncSource = "DESCONECTADO";
        isOutdated = true;
      } else if (!mpIntegration.lastSyncAt) {
        syncSource = "PENDENTE";
        isOutdated = true;
      } else {
        lastSyncAt = mpIntegration.lastSyncAt.toISOString();
        const diffInMinutes = (new Date().getTime() - mpIntegration.lastSyncAt.getTime()) / (1000 * 60);
        if (diffInMinutes > 15) {
          syncSource = "PENDENTE";
          isOutdated = true;
        } else {
          syncSource = "SINCRONIZADO";
          isOutdated = false;
        }
      }

      const txs = await db.externalTransaction.findMany({
        where: { workspaceId, integrationAccountId: mpIntegration.id },
      });
      let balance = 0;
      for (const tx of txs) {
        if (tx.direction === "CREDIT") balance += Number(tx.amountCents);
        if (tx.direction === "DEBIT") balance -= Number(tx.amountCents);
      }
      currentBalanceCents = balance;
    }

    const projectedBalanceCents = currentBalanceCents + totalReceivableMonthCents - totalPayableMonthCents;

    return {
      currentBalanceCents,
      projectedBalanceCents,
      totalPayableMonthCents,
      totalReceivableMonthCents,
      totalOverdueCents,
      totalDebtorsOwedCents: 0,
      lastSyncAt,
      syncSource,
      accountDisplayName,
      unresolvedTransactionsCount: unmatchesCount,
      uncategorizedCount: 0,
      isOutdated,
    };
  } catch (error) {
    console.error("Erro ao calcular resumo:", error);
    return {
      currentBalanceCents: 0,
      projectedBalanceCents: 0,
      totalPayableMonthCents: 0,
      totalReceivableMonthCents: 0,
      totalOverdueCents: 0,
      totalDebtorsOwedCents: 0,
      lastSyncAt: new Date().toISOString(),
      syncSource: "CALCULADO",
      accountDisplayName: "Erro",
      unresolvedTransactionsCount: 0,
      uncategorizedCount: 0,
    };
  }
}

export async function getWorkspaceName() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
    return { success: true, name: ws?.name || "Novex Finance" };
  } catch (err) {
    return { success: false, name: "Novex Finance", error: String(err) };
  }
}

export async function updateWorkspaceName(data: { name: string }) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    await db.workspace.update({ where: { id: workspaceId }, data: { name: data.name } });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function setManualInitialBalance(targetBalanceCents: number) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const mpIntegration = await db.integrationAccount.findFirst({
      where: { workspaceId, provider: "MERCADO_PAGO" },
    });

    if (!mpIntegration) {
      return { success: false, error: "Nenhuma integração conectada." };
    }

    // Exclui ajustes manuais antigos para não acumular
    await db.externalTransaction.deleteMany({
      where: {
        workspaceId,
        externalId: { startsWith: "SALDO_INICIAL_" },
      },
    });

    // Recalcula soma atual das transações sem o ajuste antigo
    const credit = await db.externalTransaction.aggregate({
      _sum: { amountCents: true },
      where: { workspaceId, direction: "CREDIT" },
    });
    const debit = await db.externalTransaction.aggregate({
      _sum: { amountCents: true },
      where: { workspaceId, direction: "DEBIT" },
    });

    const currentSum = (Number(credit._sum.amountCents) || 0) - (Number(debit._sum.amountCents) || 0);
    const diff = targetBalanceCents - currentSum;

    if (diff !== 0) {
      const isCredit = diff > 0;
      const amountCents = Math.abs(diff);

      await db.externalTransaction.create({
        data: {
          workspaceId,
          integrationAccountId: mpIntegration.id,
          provider: "MERCADO_PAGO",
          externalId: "SALDO_INICIAL_" + Date.now(),
          type: "TRANSFER",
          direction: isCredit ? "CREDIT" : "DEBIT",
          amountCents,
          netAmountCents: amountCents,
          status: "APPROVED",
          occurredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          description: "Ajuste de Saldo Inicial (Manual)",
          rawReference: "{}",
        },
      });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function getDashboardData() {
  const summary = await getWorkspaceSummary();
  const { workspaceId } = await requireAuthenticatedWorkspace();

  const txs = await db.externalTransaction.findMany({
    where: { workspaceId },
    orderBy: { occurredAt: "desc" },
    take: 10,
    include: { reconciliations: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const recentTransactions = txs.map((tx: any) => ({
    id: tx.id,
    direction: tx.direction,
    amountCents: Number(tx.amountCents),
    description: tx.description,
    counterpartName: tx.counterpartName,
    category: "Movimentação", // simplificado para não precisar do async categorize
    reconciliationStatus: tx.reconciliations[0]?.status || "UNMATCHED",
  }));

  // Chart data: agrupar por mês
  const now = new Date();
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleString('pt-BR', { month: 'short' });
    
    // Sum for this month
    const monthTxs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        occurredAt: {
          gte: new Date(d.getFullYear(), d.getMonth(), 1),
          lt: new Date(d.getFullYear(), d.getMonth() + 1, 1),
        }
      }
    });

    let entradas = 0;
    let saidas = 0;
    monthTxs.forEach((t: any) => {
      if (t.type !== "TRANSFER") {
        if (t.direction === "CREDIT") entradas += Number(t.amountCents) / 100;
        if (t.direction === "DEBIT") saidas += Number(t.amountCents) / 100;
      }
    });

    chartData.push({
      month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      entradas,
      saídas: saidas,
    });
  }

  return { summary, recentTransactions, chartData };
}

export async function triggerMercadoPagoSync(force: boolean = false) {
  try {
    const { syncMercadoPagoStatement } = await import('./transactions');
    return await syncMercadoPagoStatement(force);
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
