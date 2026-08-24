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
  try {
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
      deletedAt: item.deletedAt ? item.deletedAt.toISOString() : new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Erro ao buscar itens da lixeira:", error);
    return [];
  }
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
