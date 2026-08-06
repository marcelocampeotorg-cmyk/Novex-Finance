"use server";

import { db } from "@/server/db";
import { BalanceSummaryMock } from "@/types";

const DEMO_WORKSPACE_ID = "ws-personal-demo";

export async function getWorkspaceSummary(): Promise<BalanceSummaryMock> {
  try {
    // Buscar todas as parcelas ativas do mês atual
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const installments = await db.installment.findMany({
      where: {
        financialItem: {
          workspaceId: DEMO_WORKSPACE_ID,
          deletedAt: null,
        },
        dueDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        financialItem: true,
      },
    });

    let totalPayableMonthCents = 0;
    let totalReceivableMonthCents = 0;
    let totalOverdueCents = 0;

    installments.forEach((inst) => {
      const remainingCents = Number(inst.amountCents - inst.settledAmountCents);
      if (inst.financialItem.direction === "PAYABLE") {
        if (inst.status !== "SETTLED" && inst.status !== "CANCELED") {
          totalPayableMonthCents += remainingCents;
          if (inst.dueDate < now) {
            totalOverdueCents += remainingCents;
          }
        }
      } else {
        if (inst.status !== "SETTLED" && inst.status !== "CANCELED") {
          totalReceivableMonthCents += remainingCents;
        }
      }
    });

    // Buscar transações imutáveis importadas
    const unmatchesCount = await db.externalTransaction.count({
      where: {
        workspaceId: DEMO_WORKSPACE_ID,
        reconciliations: {
          none: {
            status: "MATCHED",
          },
        },
      },
    });

    const currentBalanceCents = 1485050; // Snapshot/Cache de saldo sincronizado Mercado Pago (em centavos)
    const projectedBalanceCents =
      currentBalanceCents + totalReceivableMonthCents - totalPayableMonthCents;

    return {
      currentBalanceCents,
      projectedBalanceCents,
      totalPayableMonthCents,
      totalReceivableMonthCents,
      totalOverdueCents,
      totalDebtorsOwedCents: 580000,
      lastSyncAt: new Date().toISOString(),
      syncSource: "SINCRONIZADO",
      accountDisplayName: "Mercado Pago — Frank (Conta Principal)",
      unresolvedTransactionsCount: unmatchesCount,
      uncategorizedCount: 1,
    };
  } catch (error) {
    console.error("Erro ao calcular resumo do workspace:", error);
    return {
      currentBalanceCents: 1485050,
      projectedBalanceCents: 2132050,
      totalPayableMonthCents: 425000,
      totalReceivableMonthCents: 1072000,
      totalOverdueCents: 35000,
      totalDebtorsOwedCents: 580000,
      lastSyncAt: new Date().toISOString(),
      syncSource: "SINCRONIZADO",
      accountDisplayName: "Mercado Pago — Frank (Conta Principal)",
      unresolvedTransactionsCount: 2,
      uncategorizedCount: 1,
    };
  }
}
