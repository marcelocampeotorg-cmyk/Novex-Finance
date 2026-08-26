"use server";

import { db } from "@/server/db";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { getActiveMercadoPagoIntegrationForWorkspace } from "@/server/services/mercado-pago-integration";

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

    // Correção G: Filtrar por mês corrente para métricas "no mês"
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let totalPayablePendingCents = 0;
    let totalReceivablePendingCents = 0;
    let totalOverdueCents = 0;

    installments.forEach((inst: any) => {
      const remainingCents = Number(inst.amountCents - inst.settledAmountCents);
      if (inst.status === "SETTLED" || inst.status === "CANCELED") return;
      const inMonth = inst.dueDate >= monthStart && inst.dueDate <= monthEnd;
      if (inst.financialItem.direction === "PAYABLE") {
        if (inMonth) totalPayablePendingCents += remainingCents;
        if (inst.dueDate < now) totalOverdueCents += remainingCents;
      } else {
        if (inMonth) totalReceivablePendingCents += remainingCents;
      }
    });

    // Correção I: IGNORED é decisão encerrada, não é unresolved
    const unmatchesCount = await db.externalTransaction.count({
      where: { workspaceId, reconciliations: { none: { status: { in: ["MATCHED", "IGNORED"] } } } },
    });
    const uncategorizedCount = await db.externalTransaction.count({
      where: { workspaceId, ledgerEntries: { some: { categoryId: null } } },
    });

    let mpIntegration = null;
    try {
      mpIntegration = await getActiveMercadoPagoIntegrationForWorkspace(workspaceId);
    } catch (e: any) {
      if (!e.message?.includes("Nenhuma integração") && !e.message?.includes("Configuração inválida")) {
        throw e;
      }
    }

    let currentBalanceCents = 0;
    let syncSource: "SINCRONIZADO" | "PENDENTE" | "DESCONECTADO" | "CALCULADO" = "CALCULADO";
    let accountDisplayName = "Conta Local";
    let lastSyncAt: string | null = null;
    let isOutdated = false;
    let balanceDescription = "Saldo em reconciliação";

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
      const netVal = Number(tx.netAmountCents);
        if (tx.direction === "CREDIT") balance += netVal;
        if (tx.direction === "DEBIT") balance -= netVal;
      }
      currentBalanceCents = balance;
      // Correção D/E: Coverage usa SOMENTE SUCCESS, não PARTIAL
      const coveredRuns = await db.syncRun.findMany({
        where: { workspaceId, integrationAccountId: mpIntegration.id, status: "SUCCESS" },
        orderBy: { beginDate: "asc" }, select: { beginDate: true, endDate: true },
      });
      let continuousStart: Date | null = null;
      let continuousEnd: Date | null = null;
      for (const run of coveredRuns) {
        if (!continuousStart) { continuousStart = run.beginDate; continuousEnd = run.endDate; continue; }
        if (continuousEnd && run.beginDate.getTime() <= continuousEnd.getTime() + 1000) {
          if (run.endDate > continuousEnd) continuousEnd = run.endDate;
        }
      }
      // Correção F: Semântica correta — movimentação líquida conhecida, não saldo absoluto
      balanceDescription = continuousStart
        ? `Movimentação líquida conhecida desde ${continuousStart.toLocaleDateString("pt-BR")}${continuousEnd && coveredRuns.some((run) => run.beginDate > continuousEnd!) ? " — cobertura com lacunas" : ""}`
        : "Movimentação líquida em reconciliação";
    }

    const debtorContacts = await db.contact.findMany({
      where: { workspaceId, isDebtor: true, deletedAt: null },
      select: { id: true }
    });
    // Correção H: totalDebtorsOwedCents = amount - settled (dívida parcial real)
    let totalDebtorsOwedCents = 0;
    if (debtorContacts.length > 0) {
      const debtorInstallments = await db.installment.findMany({
        where: {
          financialItem: {
            workspaceId,
            contactId: { in: debtorContacts.map((c: any) => c.id) },
            direction: "RECEIVABLE",
            deletedAt: null,
          },
          status: { notIn: ["SETTLED", "CANCELED"] },
        },
        select: { amountCents: true, settledAmountCents: true },
      });
      for (const di of debtorInstallments) {
        totalDebtorsOwedCents += Number(di.amountCents - di.settledAmountCents);
      }
    }

    // Correção F: Projeção é fluxo projetado, não saldo absoluto
    const projectedFlowCents = currentBalanceCents + totalReceivablePendingCents - totalPayablePendingCents;

    return {
      success: true as const,
      currentBalanceCents,
      projectedBalanceCents: projectedFlowCents,
      totalPayableMonthCents: totalPayablePendingCents,
      totalReceivableMonthCents: totalReceivablePendingCents,
      totalOverdueCents,
      totalDebtorsOwedCents,
      lastSyncAt,
      syncSource,
      accountDisplayName,
      unresolvedTransactionsCount: unmatchesCount,
      uncategorizedCount,
      balanceDescription,
      isOutdated,
      role: context.role,
      workspaceName: context.workspaceName,
      mpStatus: mpIntegration?.status || "DISCONNECTED",
      mpEnv: mpIntegration?.environment || "NAO_DETECTADO",
    };
  } catch (error: any) {
    console.error("Erro ao calcular resumo:", error);
    return {
      success: false as const,
      error: String(error.message || error),
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

export async function getDashboardData() {
  try {
    const summary = await getWorkspaceSummary();
    if (!summary.success) {
      return { success: false as const, error: summary.error || "Falha ao carregar resumo do dashboard." };
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
      amountCents: Number(tx.netAmountCents),
      description: tx.description,
      counterpartName: tx.counterpartName,
      category: "Movimentação",
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
          const val = Number(t.netAmountCents) / 100;
          if (t.direction === "CREDIT") entradas += val;
          if (t.direction === "DEBIT") saidas += val;
        }
      });

      chartData.push({
        month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        entradas,
        saídas: saidas,
      });
    }

    return { success: true as const, summary, recentTransactions, chartData, payables, debtorsCount };
  } catch (error: any) {
    console.error("Erro ao carregar dashboard:", error);
    return { success: false as const, error: error.message || String(error) };
  }
}

export async function triggerMercadoPagoSync(force: boolean = false) {
  try {
    const { syncMercadoPagoStatement } = await import('./transactions');
    return await syncMercadoPagoStatement(force);
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
}

export async function getWorkspaceLastUpdateTimestamp() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const lastTx = await db.externalTransaction.findFirst({
      where: { workspaceId },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    });
    const lastInst = await db.installment.findFirst({
      where: { financialItem: { workspaceId } },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    const lastRun = await db.syncRun.findFirst({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    const dates = [
      lastTx?.occurredAt,
      lastInst?.updatedAt,
      lastRun?.updatedAt
    ].filter(Boolean) as Date[];

    if (dates.length === 0) return { success: true, timestamp: Date.now() };
    return { success: true, timestamp: Math.max(...dates.map(d => d.getTime())) };
  } catch (err) {
    return { success: false, timestamp: Date.now() };
  }
}
