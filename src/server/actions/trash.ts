"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export interface TrashedItemDTO {
  id: string;
  title: string;
  category: string;
  direction: "PAYABLE" | "RECEIVABLE";
  deletedAt: string;
}

export async function getTrashedItems(): Promise<TrashedItemDTO[]> {
  const { workspaceId } = await requireAuthenticatedWorkspace();

  const trashedFinancialItems = await db.financialItem.findMany({
    where: {
      workspaceId,
      deletedAt: { not: null },
    },
    include: {
      category: true,
    },
    orderBy: { deletedAt: "desc" },
  });

  return trashedFinancialItems.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category?.name || "Geral",
    direction: item.direction,
    deletedAt: item.deletedAt!.toISOString(),
  }));
}

export async function restoreTrashedItem(financialItemId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    await db.financialItem.updateMany({
      where: {
        id: financialItemId,
        workspaceId,
      },
      data: {
        deletedAt: null,
      },
    });

    revalidatePath("/lixeira");
    revalidatePath("/contas-a-pagar");
    revalidatePath("/contas-a-receber");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao restaurar item da lixeira:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Exclusão permanente com verificação rigorosa de integridade financeira
 */
export async function permanentlyDeleteTrashedItem(financialItemId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    // 1. Verificar se o item pertence ao workspace e está na lixeira
    const item = await db.financialItem.findFirst({
      where: {
        id: financialItemId,
        workspaceId,
        deletedAt: { not: null },
      },
      include: {
        installments: {
          include: {
            ledgerEntries: true,
          },
        },
      },
    });

    if (!item) {
      return { success: false, error: "Item não encontrado na lixeira deste workspace." };
    }

    // 2. Verificar se possui lançamentos no Ledger / Extrato oficial vinculados
    const hasFinancialFact = item.installments.some((inst) => inst.ledgerEntries.length > 0);
    if (hasFinancialFact) {
      return {
        success: false,
        error: "Não é possível excluir permanentemente este item pois possui fatos financeiros vinculados ao extrato (LedgerEntry). Desfaça a conciliação primeiro.",
      };
    }

    // 3. Exclusão física em transação
    await db.$transaction(async (tx) => {
      await tx.installment.deleteMany({
        where: { financialItemId },
      });
      await tx.financialItem.delete({
        where: { id: financialItemId },
      });
    });

    revalidatePath("/lixeira");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao excluir permanentemente item da lixeira:", error);
    return { success: false, error: error.message };
  }
}
