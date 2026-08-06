"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export async function getExternalTransactions() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const txs = await db.externalTransaction.findMany({
      where: { workspaceId },
      include: {
        reconciliations: true,
      },
      orderBy: { occurredAt: "desc" },
    });

    return txs.map((tx) => {
      const activeRec = tx.reconciliations[0];
      return {
        id: tx.id,
        provider: tx.provider,
        externalId: tx.externalId,
        direction: tx.direction,
        type: tx.type as any,
        status: tx.status as any,
        amountCents: Number(tx.amountCents),
        netAmountCents: Number(tx.netAmountCents),
        occurredAt: tx.occurredAt.toISOString(),
        counterpartName: tx.counterpartName || undefined,
        counterpartDocument: tx.counterpartDocument || undefined,
        description: tx.description,
        reconciliationStatus: activeRec ? activeRec.status : ("UNMATCHED" as any),
        matchedInstallmentId: activeRec?.installmentId || undefined,
        category: "Geral",
        confidenceScore: activeRec?.score || undefined,
      };
    });
  } catch (error) {
    console.error("Erro ao buscar movimentações externas:", error);
    return [];
  }
}

export async function matchReconciliation(externalTransactionId: string, installmentId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    return await db.$transaction(async (tx) => {
      // Criar ou atualizar vinculo de conciliação
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

      // Atualizar status da parcela para SETTLED
      await tx.installment.update({
        where: { id: installmentId },
        data: {
          status: "SETTLED",
          settlementDate: new Date(),
        },
      });

      revalidatePath("/movimentacoes");
      revalidatePath("/contas-a-pagar");
      revalidatePath("/");
      return { success: true, reconciliation: rec };
    });
  } catch (error: any) {
    console.error("Erro ao conciliar transação:", error);
    return { success: false, error: error.message };
  }
}
