"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export async function getFinancialItems(direction?: "PAYABLE" | "RECEIVABLE") {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const items = await db.financialItem.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(direction ? { direction } : {}),
      },
      include: {
        contact: true,
        category: true,
        installments: {
          orderBy: { sequence: "asc" },
          include: { selectedPixKey: true },
        },
        _count: {
          select: { reconciliations: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return items.map((item) => ({
      id: item.id,
      direction: item.direction,
      kind: item.kind,
      title: item.title,
      description: item.description || undefined,
      contact: item.contact
        ? {
            id: item.contact.id,
            name: item.contact.name,
            type: item.contact.type,
            email: item.contact.email || undefined,
            phone: item.contact.phone || undefined,
            isDebtor: item.contact.isDebtor,
            isPayee: item.contact.isPayee,
            pixKeys: [],
          }
        : undefined,
      category: item.category?.name || "Geral",
      categoryColor: item.category?.colorToken || "#3B82F6",
      totalAmountCents: Number(item.totalAmountCents),
      startDate: item.startDate.toISOString(),
      status: item.status,
      attachmentsCount: 0,
      installments: item.installments.map((inst) => ({
        id: inst.id,
        financialItemId: inst.financialItemId,
        sequence: inst.sequence,
        totalSequences: item.installments.length,
        amountCents: Number(inst.amountCents),
        settledAmountCents: Number(inst.settledAmountCents),
        dueDate: inst.dueDate.toISOString(),
        status: inst.status,
        uniqueReference: inst.uniqueReference || `NOVEX-REF-${inst.id.slice(0, 8)}`,
        pixKey: inst.selectedPixKey
          ? {
              id: inst.selectedPixKey.id,
              type: inst.selectedPixKey.type,
              value: inst.selectedPixKey.value,
              isDefault: inst.selectedPixKey.isDefault,
            }
          : undefined,
      })),
    }));
  } catch (error) {
    console.error("Erro ao buscar itens financeiros:", error);
    return [];
  }
}

export async function createFinancialItem(input: {
  direction: "PAYABLE" | "RECEIVABLE";
  kind: "ONE_TIME" | "INSTALLMENT_PLAN" | "RECURRING";
  title: string;
  description?: string;
  contactId?: string;
  categoryName?: string;
  totalAmountCents: number;
  startDate: string;
  installments?: { sequence: number; amountCents: number; dueDate: string }[];
}) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    return await db.$transaction(async (tx) => {
      // Localizar ou criar categoria se necessário
      let categoryId: string | undefined;
      if (input.categoryName) {
        const cat = await tx.category.findFirst({
          where: { workspaceId, name: input.categoryName },
        });
        if (cat) {
          categoryId = cat.id;
        } else {
          const newCat = await tx.category.create({
            data: {
              workspaceId,
              name: input.categoryName,
              direction: input.direction === "PAYABLE" ? "EXPENSE" : "INCOME",
              colorToken: "#3B82F6",
            },
          });
          categoryId = newCat.id;
        }
      }

      // Criar item pai
      const item = await tx.financialItem.create({
        data: {
          workspaceId,
          direction: input.direction,
          kind: input.kind,
          title: input.title,
          description: input.description,
          contactId: input.contactId,
          categoryId,
          totalAmountCents: BigInt(input.totalAmountCents),
          startDate: new Date(input.startDate),
          status: "ACTIVE",
        },
      });

      // Criar parcelas
      const installmentsToCreate =
        input.installments && input.installments.length > 0
          ? input.installments
          : [{ sequence: 1, amountCents: input.totalAmountCents, dueDate: input.startDate }];

      for (const inst of installmentsToCreate) {
        await tx.installment.create({
          data: {
            financialItemId: item.id,
            sequence: inst.sequence,
            amountCents: BigInt(inst.amountCents),
            dueDate: new Date(inst.dueDate),
            status: "SCHEDULED",
            uniqueReference: `NOVEX-${input.direction.slice(0, 3)}-${Date.now().toString().slice(-6)}-${inst.sequence}`,
          },
        });
      }

      revalidatePath("/");
      revalidatePath("/contas-a-pagar");
      revalidatePath("/contas-a-receber");
      return { success: true, itemId: item.id };
    });
  } catch (error: any) {
    console.error("Erro ao criar item financeiro:", error);
    return { success: false, error: error.message };
  }
}

export async function settleInstallment(installmentId: string, amountCentsPaid?: number) {
  try {
    return await db.$transaction(async (tx) => {
      const inst = await tx.installment.findUnique({
        where: { id: installmentId },
        include: { financialItem: true },
      });

      if (!inst) throw new Error("Parcela não encontrada");

      const payAmount = amountCentsPaid ? BigInt(amountCentsPaid) : inst.amountCents;
      const newSettled = inst.settledAmountCents + payAmount;
      const isFullyPaid = newSettled >= inst.amountCents;

      // Atualizar parcela
      const updated = await tx.installment.update({
        where: { id: installmentId },
        data: {
          settledAmountCents: newSettled,
          status: isFullyPaid ? "SETTLED" : "PARTIAL",
          settlementDate: new Date(),
        },
      });

      // Criar registro derivado no LedgerEntry
      await tx.ledgerEntry.create({
        data: {
          workspaceId: inst.financialItem.workspaceId,
          installmentId: inst.id,
          direction: inst.financialItem.direction === "PAYABLE" ? "DEBIT" : "CREDIT",
          amountCents: payAmount,
          occurredAt: new Date(),
          sourceType: "INSTALLMENT_PAYMENT",
          sourceId: inst.id,
          categoryId: inst.financialItem.categoryId,
        },
      });

      revalidatePath("/");
      revalidatePath("/contas-a-pagar");
      revalidatePath("/contas-a-receber");
      return { success: true, installment: updated };
    });
  } catch (error: any) {
    console.error("Erro ao dar baixa em parcela:", error);
    return { success: false, error: error.message };
  }
}
