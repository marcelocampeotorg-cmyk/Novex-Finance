if (process.env.NODE_ENV !== "test") {
  try { require("server-only"); } catch (e) {}
}

import { db } from "../db.ts";
function safeRevalidatePath(path: string) {
  try {
    const { revalidatePath } = require("next/cache");
    revalidatePath(path);
  } catch (e) {
    // Ignorado em testes unitários fora do runtime Next.js
  }
}
import { requireAuthenticatedWorkspace } from "../auth-context.ts";

export interface CreateRecurrenceInput {
  title: string;
  description?: string;
  direction: "PAYABLE" | "RECEIVABLE";
  amountCents: number;
  frequency: "MONTHLY" | "WEEKLY" | "ANNUAL";
  interval?: number;
  dayOfMonth?: number;
  contactId?: string;
  categoryName?: string;
  startsAt: string;
  endsAt?: string;
}

/**
 * Calcula a próxima data de ocorrência da regra de recorrência
 */
export async function calculateNextRecurrenceDate(
  currentDate: Date,
  frequency: string,
  interval: number = 1,
  dayOfMonth?: number
): Promise<Date> {
  const next = new Date(currentDate.getTime());

  if (frequency === "WEEKLY") {
    next.setDate(next.getDate() + 7 * interval);
  } else if (frequency === "ANNUAL") {
    next.setFullYear(next.getFullYear() + interval);
  } else {
    // MONTHLY por padrão
    next.setMonth(next.getMonth() + interval);
    if (dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 31) {
      // Ajustar para o dia do mês desejado mantendo limites de fim de mês
      const maxDaysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(dayOfMonth, maxDaysInMonth));
    }
  }

  return next;
}

export async function getRecurrenceRules(targetWorkspaceId?: string) {
  try {
    const workspaceId = targetWorkspaceId || (await requireAuthenticatedWorkspace()).workspaceId;

    const rules = await db.recurrenceRule.findMany({
      where: { workspaceId },
      include: {
        financialItems: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { contact: true, category: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true as const,
      rules: rules.map((rule) => {
        const sampleItem = rule.financialItems[0];
        return {
          id: rule.id,
          title: sampleItem?.title || "Recorrência sem título",
          description: sampleItem?.description || undefined,
          direction: sampleItem?.direction || "PAYABLE",
          amountCents: sampleItem ? Number(sampleItem.totalAmountCents) : 0,
          frequency: rule.frequency,
          interval: rule.interval,
          dayOfMonth: rule.dayOfMonth || undefined,
          startsAt: rule.startsAt.toISOString(),
          endsAt: rule.endsAt ? rule.endsAt.toISOString() : undefined,
          nextRunAt: rule.nextRunAt ? rule.nextRunAt.toISOString() : rule.startsAt.toISOString(),
          active: rule.active,
          contactName: sampleItem?.contact?.name || undefined,
          categoryName: sampleItem?.category?.name || "Geral",
        };
      }),
    };
  } catch (error: any) {
    console.error("Erro ao buscar regras de recorrência:", error);
    return {
      success: false as const,
      error: error?.message || String(error),
    };
  }
}

export async function createRecurrenceRule(input: CreateRecurrenceInput) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    return await db.$transaction(async (tx) => {
      const startDate = new Date(input.startsAt);
      const targetDay = input.dayOfMonth || startDate.getDate();
      const interval = input.interval || 1;

      // Calcular primeira e próxima data de execução
      const nextRunDate = await calculateNextRecurrenceDate(startDate, input.frequency, interval, targetDay);

      // Localizar ou criar categoria
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

      // Criar a Regra de Recorrência
      const rule = await tx.recurrenceRule.create({
        data: {
          workspaceId,
          frequency: input.frequency,
          interval,
          dayOfMonth: targetDay,
          startsAt: startDate,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          nextRunAt: nextRunDate,
          active: true,
        },
      });

      // Gerar a primeira ocorrência do FinancialItem & Installment imediata
      const financialItem = await tx.financialItem.create({
        data: {
          workspaceId,
          direction: input.direction,
          kind: "RECURRING",
          title: input.title,
          description: input.description,
          contactId: input.contactId || null,
          categoryId: categoryId || null,
          totalAmountCents: BigInt(input.amountCents),
          startDate: startDate,
          status: "ACTIVE",
          recurrenceRuleId: rule.id,
        },
      });

      await tx.installment.create({
        data: {
          financialItemId: financialItem.id,
          sequence: 1,
          amountCents: BigInt(input.amountCents),
          dueDate: startDate,
          status: "SCHEDULED",
          uniqueReference: `REC-${rule.id.slice(0, 6)}-1`,
        },
      });

      safeRevalidatePath("/recorrencias");
      safeRevalidatePath("/contas-a-pagar");
      safeRevalidatePath("/contas-a-receber");
      safeRevalidatePath("/");
      return { success: true, ruleId: rule.id };
    });
  } catch (error: any) {
    console.error("Erro ao criar regra de recorrência:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Processa regras ativas e gera ocorrências pendentes até a data atual
 */
export async function processActiveRecurrencesForWorkspace(targetWorkspaceId?: string) {
  try {
    const workspaceId = targetWorkspaceId || (await requireAuthenticatedWorkspace()).workspaceId;
    const now = new Date();

    const activeRules = await db.recurrenceRule.findMany({
      where: {
        workspaceId,
        active: true,
        OR: [
          { nextRunAt: { lte: now } },
          { nextRunAt: null },
        ],
      },
      include: {
        financialItems: {
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    });

    let generatedCount = 0;

    for (const rule of activeRules) {
      const templateItem = rule.financialItems[0];
      if (!templateItem) continue;

      if (rule.endsAt && now > rule.endsAt) {
        // Desativar regra que passou da data limite
        await db.recurrenceRule.update({
          where: { id: rule.id },
          data: { active: false },
        });
        continue;
      }

      const runDate = rule.nextRunAt || rule.startsAt;

      try {
        await db.$transaction(async (tx) => {
          const existingItemsCount = await tx.financialItem.count({
            where: { recurrenceRuleId: rule.id },
          });
          const sequenceNumber = existingItemsCount + 1;

          const newItem = await tx.financialItem.create({
            data: {
              workspaceId,
              direction: templateItem.direction,
              kind: "RECURRING",
              title: templateItem.title,
              description: templateItem.description,
              contactId: templateItem.contactId,
              categoryId: templateItem.categoryId,
              totalAmountCents: templateItem.totalAmountCents,
              startDate: runDate,
              status: "ACTIVE",
              recurrenceRuleId: rule.id,
              scheduledOccurrenceAt: runDate,
            },
          });

          await tx.installment.create({
            data: {
              financialItemId: newItem.id,
              sequence: sequenceNumber,
              amountCents: templateItem.totalAmountCents,
              dueDate: runDate,
              status: "SCHEDULED",
              uniqueReference: `REC-${rule.id.slice(0, 6)}-${sequenceNumber}`,
            },
          });

          const nextRunDate = await calculateNextRecurrenceDate(runDate, rule.frequency, rule.interval, rule.dayOfMonth || undefined);
          await tx.recurrenceRule.update({
            where: { id: rule.id },
            data: { nextRunAt: nextRunDate },
          });
        });
        generatedCount++;
      } catch (e: any) {
        if (e.code === "P2002") {
          console.log(`[RecurrenceService] Ocorrência para regra ${rule.id} em ${runDate.toISOString()} já criada por outro worker (idempotente).`);
        } else {
          throw e;
        }
      }
    }

    safeRevalidatePath("/recorrencias");
    safeRevalidatePath("/contas-a-pagar");
    safeRevalidatePath("/contas-a-receber");
    safeRevalidatePath("/");

    return { success: true, generatedCount };
  } catch (error: any) {
    console.error("Erro no processamento de recorrências:", error);
    return { success: false, error: error.message };
  }
}

export async function toggleRecurrenceRule(ruleId: string, active: boolean) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    await db.recurrenceRule.updateMany({
      where: { id: ruleId, workspaceId },
      data: { active },
    });

    safeRevalidatePath("/recorrencias");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao alterar status da recorrência:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteRecurrenceRule(ruleId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    await db.recurrenceRule.deleteMany({
      where: { id: ruleId, workspaceId },
    });

    safeRevalidatePath("/recorrencias");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao deletar regra de recorrência:", error);
    return { success: false, error: error.message };
  }
}
