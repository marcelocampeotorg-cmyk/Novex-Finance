"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { getActiveMercadoPagoIntegrationForWorkspace } from "@/server/services/mercado-pago-integration";
import { calculateAnchoredBalance, calculateConsolidatedBalance } from "@/domain/financial-balance";

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
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { financeMode: true, financialAccounts: true },
    });
    const financeMode = workspace?.financeMode || "MANUAL";
    const manualAccount = workspace?.financialAccounts.find((account) => account.type === "MANUAL") || null;
    const mercadoPagoAccount = workspace?.financialAccounts.find((account) => account.type === "MERCADO_PAGO") || null;

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
      where: { workspaceId, quarantinedAt: null, reconciliations: { none: { status: { in: ["MATCHED", "IGNORED"] } } } },
    });
    const uncategorizedCount = await db.externalTransaction.count({
      where: { workspaceId, quarantinedAt: null, ledgerEntries: { some: { categoryId: null } } },
    });
    const quarantineCount = await db.externalTransaction.count({ where: { workspaceId, quarantinedAt: { not: null } } });

    let manualBalanceCents: number | null = null;
    if (manualAccount?.openingBalanceCents !== null && manualAccount?.openingBalanceAt) {
      const entries = await db.ledgerEntry.findMany({
        where: {
          workspaceId,
          financialAccountId: manualAccount.id,
          occurredAt: { gte: manualAccount.openingBalanceAt },
          OR: [{ externalTransaction: null }, { externalTransaction: { quarantinedAt: null } }],
        },
        select: { direction: true, amountCents: true },
      });
      manualBalanceCents = calculateAnchoredBalance(Number(manualAccount.openingBalanceCents), entries.map((entry) => ({ direction: entry.direction, amountCents: Number(entry.amountCents) })));
    }

    let mpIntegration = null;
    if (financeMode === "HYBRID") {
      try {
        mpIntegration = await getActiveMercadoPagoIntegrationForWorkspace(workspaceId);
      } catch (e: any) {
        if (!e.message?.includes("Nenhuma integração") && !e.message?.includes("Configuração inválida")) {
          throw e;
        }
      }
    }

    let knownNetMovementCents = 0;
    let syncSource: "SINCRONIZADO" | "PENDENTE" | "DESCONECTADO" | "CALCULADO" = "CALCULADO";
    let accountDisplayName = "Conta Local";
    let lastSyncAt: string | null = null;
    let isOutdated = false;
    let balanceDescription = "Saldo em reconciliação";

    if (mpIntegration) {
      accountDisplayName = mpIntegration.displayName || "Mercado Pago";
      
      const lastRun = await db.syncRun.findFirst({
        where: { workspaceId, integrationAccountId: mpIntegration.id },
        orderBy: { createdAt: "desc" },
      });

      if (mpIntegration.status !== "CONNECTED" || mpIntegration.lastValidationErrorCode) {
        syncSource = "DESCONECTADO";
        isOutdated = true;
      } else if (!mpIntegration.lastSyncAt || lastRun?.status === "PARTIAL") {
        syncSource = "PENDENTE";
        isOutdated = true;
        lastSyncAt = mpIntegration.lastSyncAt ? mpIntegration.lastSyncAt.toISOString() : null;
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
        where: { workspaceId, integrationAccountId: mpIntegration.id, quarantinedAt: null },
      });
      let balance = 0;
      for (const tx of txs) {
      const netVal = Number(tx.netAmountCents);
        if (tx.direction === "CREDIT") balance += netVal;
        if (tx.direction === "DEBIT") balance -= netVal;
      }
      knownNetMovementCents = balance;
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

    // Métricas Reais do Mês Atual
    const monthTxs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        quarantinedAt: null,
        occurredAt: { gte: monthStart, lte: monthEnd },
      },
      select: { direction: true, netAmountCents: true },
    });

    let monthIncomeCents = 0;
    let monthExpenseCents = 0;
    for (const t of monthTxs) {
      const val = Number(t.netAmountCents);
      if (t.direction === "CREDIT") monthIncomeCents += val;
      if (t.direction === "DEBIT") monthExpenseCents += val;
    }
    const monthNetCents = monthIncomeCents - monthExpenseCents;

    // Correção F: Projeção é fluxo projetado, não saldo absoluto
    const projectedFlowCents = knownNetMovementCents + totalReceivablePendingCents - totalPayablePendingCents;
    const mercadoPagoBalanceStatus: "CONFIRMED" | "RECONCILING" | "UNAVAILABLE" =
      mercadoPagoAccount?.officialBalanceStatus === "CONFIRMED"
        ? "CONFIRMED"
        : mpIntegration && mpIntegration.status === "CONNECTED"
        ? "RECONCILING"
        : "UNAVAILABLE";

    let mercadoPagoOfficialBalanceCents: number | null = null;
    if (mercadoPagoAccount?.officialBalanceStatus === "CONFIRMED" && mercadoPagoAccount?.officialBalanceCents !== null && mercadoPagoAccount?.officialBalanceCents !== undefined) {
      mercadoPagoOfficialBalanceCents = Number(mercadoPagoAccount.officialBalanceCents);
    } else {
      mercadoPagoOfficialBalanceCents = null;
    }

    const consolidatedBalanceCents = calculateConsolidatedBalance({ mode: financeMode, manualBalanceCents, mercadoPagoOfficialBalanceCents });

    const formattedAccounts = (workspace?.financialAccounts || []).map((acc) => ({
      id: acc.id,
      type: acc.type as "MANUAL" | "MERCADO_PAGO" | "BANK_ACCOUNT",
      name: acc.name,
      openingBalanceCents: acc.openingBalanceCents !== null ? Number(acc.openingBalanceCents) : null,
      openingBalanceAt: acc.openingBalanceAt ? acc.openingBalanceAt.toISOString() : null,
      officialBalanceCents: acc.officialBalanceCents !== null ? Number(acc.officialBalanceCents) : null,
      officialBalanceStatus: acc.officialBalanceStatus,
    }));

    return {
      success: true as const,
      knownNetMovementCents,
      manualBalanceCents,
      manualBalanceAt: manualAccount?.openingBalanceAt?.toISOString() || null,
      mercadoPagoOfficialBalanceCents,
      mercadoPagoOfficialBalanceAt: mercadoPagoAccount?.openingBalanceAt?.toISOString() || mercadoPagoAccount?.officialBalanceAt?.toISOString() || null,
      mercadoPagoBalanceStatus,
      consolidatedBalanceCents,
      financeMode,
      monthIncomeCents,
      monthExpenseCents,
      monthNetCents,
      financialAccounts: formattedAccounts,
      quarantineCount,
      coverageStart: mpIntegration?.coverageStart?.toISOString() || null,
      coverageEnd: mpIntegration?.coverageEnd?.toISOString() || null,
      historyBackfillStatus: mpIntegration?.historyBackfillStatus || null,
      projectedKnownFlowCents: projectedFlowCents,
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

export async function setAccountBalanceAnchor(data: {
  financialAccountId: string;
  openingBalanceCents: number;
  openingBalanceAt: string;
}) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const account = await db.financialAccount.findFirst({
      where: { id: data.financialAccountId, workspaceId },
    });
    if (!account) return { success: false, error: "Conta financeira não encontrada." };
    if (account.type !== "MANUAL") {
      return { success: false, error: "Apenas contas manuais podem receber âncora de saldo manual. A conta Mercado Pago não pode ser alterada manualmente." };
    }

    const anchorDate = new Date(data.openingBalanceAt);
    if (isNaN(anchorDate.getTime())) return { success: false, error: "Data de âncora inválida." };

    await db.financialAccount.update({
      where: { id: account.id },
      data: {
        openingBalanceCents: BigInt(data.openingBalanceCents),
        openingBalanceAt: anchorDate,
      },
    });

    revalidatePath("/");
    revalidatePath("/configuracoes");
    revalidatePath("/movimentacoes");
    revalidatePath("/relatorios");

    return { success: true };
  } catch (err: any) {
    console.error("Erro ao definir âncora de saldo:", err);
    return { success: false, error: err.message || String(err) };
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
      where: { workspaceId, quarantinedAt: null, source: summary.financeMode === "MANUAL" ? "MANUAL_ADJUSTMENT" : undefined },
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
          quarantinedAt: null,
          source: summary.financeMode === "MANUAL" ? "MANUAL_ADJUSTMENT" : undefined,
          occurredAt: {
            gte: new Date(d.getFullYear(), d.getMonth(), 1),
            lt: new Date(d.getFullYear(), d.getMonth() + 1, 1),
          }
        }
      });

      let entradas = 0;
      let saidas = 0;
      monthTxs.forEach((t: any) => {
        const val = Number(t.netAmountCents) / 100;
        if (t.direction === "CREDIT") entradas += val;
        if (t.direction === "DEBIT") saidas += val;
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

    if (dates.length === 0) return { success: true, timestamp: 0 };
    return { success: true, timestamp: Math.max(...dates.map(d => d.getTime())) };
  } catch (err) {
    return { success: false, timestamp: 0 };
  }
}
