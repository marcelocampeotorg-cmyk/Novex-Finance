"use server";

import { db } from "@/server/db";
import { BalanceSummaryMock } from "@/types";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { IntegrationAccount } from "@prisma/client";

export type IntegrationAccountDTO = {
  id: string;
  provider: string;
  status: string;
  environment: string | null;
  displayName: string | null;
  lastSyncAt: Date | null;
  lastValidatedAt: Date | null;
  lastValidationErrorCode: string | null;
};

/**
 * Obtém a integração ativa do Mercado Pago para o Workspace atual,
 * de forma determinística e segura.
 */
export async function getActiveMercadoPagoIntegration(workspaceIdParam?: string): Promise<IntegrationAccountDTO | null> {
  const context = await requireAuthenticatedWorkspace();
  const workspaceId = workspaceIdParam || context.workspaceId;
  
  if (workspaceId !== context.workspaceId) {
    throw new Error("Unauthorized workspace access");
  }

  const integrations = await db.integrationAccount.findMany({
    where: {
      workspaceId,
      provider: "MERCADO_PAGO",
      status: "CONNECTED",
    },
    orderBy: {
      lastValidatedAt: 'desc'
    },
    take: 1,
    select: {
      id: true,
      provider: true,
      status: true,
      environment: true,
      displayName: true,
      lastSyncAt: true,
      lastValidatedAt: true,
      lastValidationErrorCode: true,
    }
  });

  return integrations.length > 0 ? (integrations[0] as IntegrationAccountDTO) : null;
}
export async function getWorkspaceSummary() {
  try {
    const context = await requireAuthenticatedWorkspace();
    const workspaceId = context.workspaceId;

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

    const mpIntegration = await getActiveMercadoPagoIntegration(workspaceId);

    let currentBalanceCents = 0;
    let syncSource: "SINCRONIZADO" | "PENDENTE" | "DESCONECTADO" | "CALCULADO" = "CALCULADO";
    let accountDisplayName = "Conta Local";
    let lastSyncAt: string | null = null;
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
        lastSyncAt = null;
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

    const debtorContacts = await db.contact.findMany({
      where: { workspaceId, isDebtor: true, deletedAt: null },
      select: { id: true }
    });
    let totalDebtorsOwedCents = 0;
    if (debtorContacts.length > 0) {
      const debtorItems = await db.installment.aggregate({
        _sum: { amountCents: true },
        where: {
          financialItem: {
            workspaceId,
            contactId: { in: debtorContacts.map((c: any) => c.id) },
            direction: "RECEIVABLE",
            deletedAt: null,
          },
          status: { notIn: ["SETTLED", "CANCELED"] },
        },
      });
      totalDebtorsOwedCents = Number(debtorItems._sum.amountCents) || 0;
    }

    const projectedBalanceCents = currentBalanceCents + totalReceivableMonthCents - totalPayableMonthCents;

    return {
      success: true as const,
      currentBalanceCents,
      projectedBalanceCents,
      totalPayableMonthCents,
      totalReceivableMonthCents,
      totalOverdueCents,
      totalDebtorsOwedCents,
      lastSyncAt,
      syncSource,
      accountDisplayName,
      unresolvedTransactionsCount: unmatchesCount,
      uncategorizedCount: 0,
      isOutdated,
      role: context.role,
      workspaceName: context.workspaceName,
      mpStatus: mpIntegration?.status || "DISCONNECTED",
      mpEnv: mpIntegration?.environment || "SANDBOX",
    };
  } catch (error: any) {
    console.error("Erro ao calcular resumo:", error);
    return {
      success: false as const,
      error: String(error),
    };
  }
}

export async function getWorkspaceName() {
  try {
    const { workspaceId, workspaceName } = await requireAuthenticatedWorkspace();
    const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
    return { success: true, name: ws?.name || workspaceName || "Novex Finance" };
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
  return {
    success: false,
    error: "Mecanismo de Saldo Inicial Manual desativado na V1. O saldo oficial é derivado exclusivamente de movimentações reais e relatórios de liquidação (Dinheiro em Conta).",
  };
}

export async function getDashboardData() {
  const summary = await getWorkspaceSummary();
  if (!summary.success) {
    return { summary: null, recentTransactions: [], chartData: [], payables: [], debtorsCount: 0 };
  }
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

  const rawPayables = await db.financialItem.findMany({
    where: { workspaceId, direction: "PAYABLE", status: "ACTIVE", deletedAt: null },
    include: {
      installments: { where: { status: { notIn: ["SETTLED", "CANCELED"] } }, orderBy: { dueDate: "asc" }, take: 1 },
      contact: true,
      category: true,
    },
    orderBy: { startDate: "asc" },
    take: 5,
  });

  const payables = rawPayables.map((item: any) => ({
    id: item.id,
    title: item.title,
    contact: item.contact,
    category: item.category?.name || "Geral",
    categoryColor: item.category?.colorToken || "#6B7280",
    startDate: item.startDate.toISOString(),
    installments: item.installments.map((inst: any) => ({
      id: inst.id,
      sequence: inst.sequence,
      amountCents: Number(inst.amountCents),
      dueDate: inst.dueDate.toISOString(),
      status: inst.status,
    })),
  }));

  const debtorsCount = await db.contact.count({
    where: { workspaceId, isDebtor: true, deletedAt: null },
  });

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

  return { summary, recentTransactions, chartData, payables, debtorsCount };
}

export async function triggerMercadoPagoSync(force: boolean = false) {
  try {
    const { syncMercadoPagoStatement } = await import('./transactions');
    return await syncMercadoPagoStatement(force);
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}
