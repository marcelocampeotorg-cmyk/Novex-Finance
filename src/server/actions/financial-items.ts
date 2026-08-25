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
        contact: { include: { pixKeys: true } },
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
          pixKeys: item.contact.pixKeys.map((k: any) => ({
            id: k.id,
            type: k.type,
            value: k.value,
            isDefault: k.isDefault,
          })),
        }
        : undefined,
      pixKey: item.contact?.pixKeys?.[0]?.value || undefined,
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
        uniqueReference: inst.uniqueReference || undefined,
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
    throw new Error(`Falha ao consultar itens financeiros: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function createFinancialItem(input: {
  direction: "PAYABLE" | "RECEIVABLE";
  kind: "ONE_TIME" | "INSTALLMENT_PLAN" | "RECURRING";
  title: string;
  description?: string;
  contactId?: string;
  contactName?: string;
  pixKey?: string;
  pixKeyType?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
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

      // Localizar ou criar Contato
      let finalContactId = input.contactId;
      if (!finalContactId && input.contactName) {
        const existingContact = await tx.contact.findFirst({
          where: { workspaceId, name: input.contactName }
        });

        if (existingContact) {
          finalContactId = existingContact.id;
        } else {
          const newContact = await tx.contact.create({
            data: {
              workspaceId,
              name: input.contactName,
              type: "PERSON",
              isPayee: input.direction === "PAYABLE",
              isDebtor: input.direction === "RECEIVABLE",
            }
          });
          finalContactId = newContact.id;
        }
      }

      // Salvar Chave Pix se fornecida corretamente
      if (finalContactId && input.pixKey && input.pixKeyType && input.direction === "PAYABLE") {
        const existingKey = await tx.pixKey.findFirst({
          where: { contactId: finalContactId, value: input.pixKey }
        });
        if (!existingKey) {
          await tx.pixKey.create({
            data: {
              contactId: finalContactId,
              type: input.pixKeyType === "EVP" ? "RANDOM" : input.pixKeyType,
              value: input.pixKey,
              isDefault: true
            }
          });
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
          contactId: finalContactId,
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
        const uniqueSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
        await tx.installment.create({
          data: {
            financialItemId: item.id,
            sequence: inst.sequence,
            amountCents: BigInt(inst.amountCents),
            dueDate: new Date(inst.dueDate),
            status: "SCHEDULED",
            uniqueReference: `NOVEX-${input.direction.slice(0, 3)}-${uniqueSuffix}-${inst.sequence}`,
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

export async function deleteFinancialItem(itemId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    await db.financialItem.update({
      where: { id: itemId, workspaceId },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/");
    revalidatePath("/contas-a-pagar");
    revalidatePath("/contas-a-receber");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao excluir item financeiro:", error);
    return { success: false, error: error.message };
  }
}

export async function updateFinancialItem(input: {
  id: string;
  direction: "PAYABLE" | "RECEIVABLE";
  kind: "ONE_TIME" | "INSTALLMENT_PLAN" | "RECURRING";
  title: string;
  description?: string;
  contactName?: string;
  pixKey?: string;
  pixKeyType?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  categoryName?: string;
  totalAmountCents: number;
  startDate: string;
  installments?: { sequence: number; amountCents: number; dueDate: string }[];
}) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    return await db.$transaction(async (tx) => {
      const existing = await tx.financialItem.findFirst({
        where: { id: input.id, workspaceId, deletedAt: null },
      });
      if (!existing) throw new Error("Item não encontrado");

      let categoryId: string | undefined = existing.categoryId || undefined;
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

      let finalContactId = existing.contactId;
      if (input.contactName) {
        const existingContact = await tx.contact.findFirst({
          where: { workspaceId, name: input.contactName },
        });
        if (existingContact) {
          finalContactId = existingContact.id;
        } else {
          const newContact = await tx.contact.create({
            data: {
              workspaceId,
              name: input.contactName,
              type: "PERSON",
              isPayee: input.direction === "PAYABLE",
              isDebtor: input.direction === "RECEIVABLE",
            },
          });
          finalContactId = newContact.id;
        }
      }

      if (finalContactId && input.pixKey && input.pixKeyType && input.direction === "PAYABLE") {
        const existingKey = await tx.pixKey.findFirst({
          where: { contactId: finalContactId, value: input.pixKey },
        });
        if (!existingKey) {
          await tx.pixKey.create({
            data: {
              contactId: finalContactId,
              type: input.pixKeyType === "EVP" ? "RANDOM" : input.pixKeyType,
              value: input.pixKey,
              isDefault: true,
            },
          });
        }
      }

      await tx.financialItem.update({
        where: { id: input.id },
        data: {
          direction: input.direction,
          kind: input.kind,
          title: input.title,
          description: input.description,
          contactId: finalContactId,
          categoryId,
          totalAmountCents: BigInt(input.totalAmountCents),
          startDate: new Date(input.startDate),
        },
      });

      const existingInsts = await tx.installment.findMany({
        where: { financialItemId: input.id },
        orderBy: { sequence: "asc" },
      });

      const installmentsToSet =
        input.installments && input.installments.length > 0
          ? input.installments
          : [{ sequence: 1, amountCents: input.totalAmountCents, dueDate: input.startDate }];

      if (existingInsts.length === installmentsToSet.length) {
        for (let i = 0; i < existingInsts.length; i++) {
          const inst = existingInsts[i];
          const newInstData = installmentsToSet[i];
          if (inst.status !== "SETTLED") {
            await tx.installment.update({
              where: { id: inst.id },
              data: {
                amountCents: BigInt(newInstData.amountCents),
                dueDate: new Date(newInstData.dueDate),
              },
            });
          }
        }
      } else {
        const hasSettled = existingInsts.some((i) => i.status === "SETTLED");
        if (!hasSettled) {
          await tx.installment.deleteMany({ where: { financialItemId: input.id } });
          for (const inst of installmentsToSet) {
            const uniqueSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
            await tx.installment.create({
              data: {
                financialItemId: input.id,
                sequence: inst.sequence,
                amountCents: BigInt(inst.amountCents),
                dueDate: new Date(inst.dueDate),
                status: "SCHEDULED",
                uniqueReference: `NOVEX-${input.direction.slice(0, 3)}-${uniqueSuffix}-${inst.sequence}`,
              },
            });
          }
        }
      }

      revalidatePath("/");
      revalidatePath("/contas-a-pagar");
      revalidatePath("/contas-a-receber");
      return { success: true };
    });
  } catch (error: any) {
    console.error("Erro ao atualizar item financeiro:", error);
    return { success: false, error: error.message };
  }
}

export async function getOrCreatePaymentIntention(installmentId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const inst = await db.installment.findFirst({
      where: {
        id: installmentId,
        financialItem: { workspaceId, deletedAt: null },
      },
      include: {
        financialItem: {
          include: { contact: { include: { pixKeys: true } } },
        },
        selectedPixKey: true,
      },
    });

    if (!inst) {
      return { success: false, error: "Parcela não encontrada ou sem permissão." };
    }

    const contact = inst.financialItem.contact;
    const pixKeyObj = inst.selectedPixKey || contact?.pixKeys?.[0];
    const pixKeyValue = pixKeyObj?.value;
    const pixKeyType = pixKeyObj?.type;

    if (!pixKeyValue || !pixKeyType) {
      return { success: false, error: "Favorecido precisa possuir chave Pix e tipo de chave cadastrados." };
    }

    const favoredName = contact?.name?.trim();
    if (!favoredName) return { success: false, error: "Nome real do favorecido não cadastrado." };
    const merchantCity = contact?.merchantCity?.trim();
    if (!merchantCity) return { success: false, error: "Cidade real do favorecido não cadastrada." };

    // Procurar intenção de pagamento ativa existente
    const existingIntention = await db.paymentIntention.findFirst({
      where: {
        workspaceId,
        installmentId: inst.id,
        status: "WAITING",
      },
    });

    if (existingIntention && existingIntention.brCodePayload) {
      return {
        success: true,
        intention: {
          id: existingIntention.id,
          favoredName: existingIntention.favoredName,
          favoredPixKey: existingIntention.favoredPixKey,
          favoredPixKeyType: existingIntention.favoredPixKeyType,
          expectedAmountCents: Number(existingIntention.expectedAmountCents),
          brCodePayload: existingIntention.brCodePayload,
          txid: existingIntention.txid,
        },
      };
    }

    const { generatePixPayload } = await import("@/lib/pix");

    const txid = inst.uniqueReference
      ? inst.uniqueReference.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25)
      : `INT${inst.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20)}`;

    const brCodePayload = generatePixPayload({
      pixKey: pixKeyValue,
      amount: Number(inst.amountCents) / 100,
      merchantName: favoredName,
      merchantCity,
      txId: txid,
    });

    let newIntention;
    try { newIntention = await db.paymentIntention.create({
      data: {
        workspaceId,
        financialItemId: inst.financialItemId,
        installmentId: inst.id,
        favoredName,
        favoredPixKey: pixKeyValue,
        favoredPixKeyType: pixKeyType,
        expectedAmountCents: inst.amountCents,
        status: "WAITING",
        txid,
        brCodePayload,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    }); } catch (error: any) {
      if (error?.code !== "P2002") throw error;
      newIntention = await db.paymentIntention.findFirstOrThrow({ where: { workspaceId, installmentId: inst.id, status: "WAITING" } });
    }

    return {
      success: true,
      intention: {
        id: newIntention.id,
        favoredName: newIntention.favoredName,
        favoredPixKey: newIntention.favoredPixKey,
        favoredPixKeyType: newIntention.favoredPixKeyType,
        expectedAmountCents: Number(newIntention.expectedAmountCents),
        brCodePayload: newIntention.brCodePayload,
        txid: newIntention.txid,
      },
    };
  } catch (error: any) {
    console.error("Erro ao gerar intenção de pagamento:", error);
    return { success: false, error: error.message || String(error) };
  }
}
