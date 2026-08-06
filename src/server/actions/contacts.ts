"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export async function getContacts() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const contacts = await db.contact.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      include: {
        pixKeys: true,
        financialItems: {
          include: {
            installments: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return contacts.map((c) => {
      // Calcular saldo pendente devido pelo contato (se for devedor)
      const totalOwedCents = c.financialItems
        .filter((fi) => fi.direction === "RECEIVABLE" && fi.status === "ACTIVE")
        .flatMap((fi) => fi.installments)
        .filter((inst) => inst.status !== "SETTLED" && inst.status !== "CANCELED")
        .reduce(
          (acc, inst) =>
            acc + (Number(inst.amountCents) - Number(inst.settledAmountCents)),
          0
        );

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        document: c.document || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        isDebtor: c.isDebtor,
        isPayee: c.isPayee,
        notes: c.notes || undefined,
        totalOwedCents,
        pixKeys: c.pixKeys.map((pk) => ({
          id: pk.id,
          type: pk.type,
          value: pk.value,
          label: pk.label || undefined,
          isDefault: pk.isDefault,
        })),
      };
    });
  } catch (error) {
    console.error("Erro ao buscar contatos do banco:", error);
    return [];
  }
}

export async function createContact(input: {
  name: string;
  type: "PERSON" | "COMPANY";
  document?: string;
  email?: string;
  phone?: string;
  isDebtor?: boolean;
  isPayee?: boolean;
  notes?: string;
  pixKeyValue?: string;
  pixKeyType?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";
}) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const newContact = await db.contact.create({
      data: {
        workspaceId,
        name: input.name,
        type: input.type,
        document: input.document,
        email: input.email,
        phone: input.phone,
        isDebtor: input.isDebtor ?? false,
        isPayee: input.isPayee ?? true,
        notes: input.notes,
        ...(input.pixKeyValue
          ? {
              pixKeys: {
                create: {
                  type: input.pixKeyType || "CPF",
                  value: input.pixKeyValue,
                  isDefault: true,
                },
              },
            }
          : {}),
      },
    });

    revalidatePath("/devedores");
    revalidatePath("/contas-a-pagar");
    revalidatePath("/contas-a-receber");
    return { success: true, contact: newContact };
  } catch (error: any) {
    console.error("Erro ao criar contato:", error);
    return { success: false, error: error.message };
  }
}
