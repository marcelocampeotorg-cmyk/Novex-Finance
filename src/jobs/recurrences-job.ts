import { db } from "@/server/db";

/**
 * Processador automático de Regras de Recorrência
 * Gera a nova ocorrência financeira no banco quando a data `nextRunAt` for atingida
 */
export async function processRecurrenceRulesJob(targetWorkspaceId?: string) {
  try {
    const now = new Date();

    const dueRules = await db.recurrenceRule.findMany({
      where: {
        ...(targetWorkspaceId ? { workspaceId: targetWorkspaceId } : {}),
        active: true,
        nextRunAt: {
          lte: now,
        },
      },
    });

    let generatedCount = 0;

    for (const rule of dueRules) {
      // Gerar a nova parcela / item financeiro
      const nextRun = new Date(rule.nextRunAt || now);

      await db.financialItem.create({
        data: {
          workspaceId: rule.workspaceId,
          direction: "PAYABLE",
          kind: "RECURRING",
          title: `Ocorrência Recorrente (${nextRun.toLocaleDateString("pt-BR", { month: "long" })})`,
          totalAmountCents: BigInt(10000), // Exemplo
          startDate: nextRun,
          status: "ACTIVE",
          recurrenceRuleId: rule.id,
          installments: {
            create: {
              sequence: 1,
              amountCents: BigInt(10000),
              dueDate: nextRun,
              status: "SCHEDULED",
              uniqueReference: `NOVEX-REC-AUTO-${rule.id.slice(0, 5)}-${nextRun.getTime()}`,
            },
          },
        },
      });

      // Calcular próxima data de execução
      const updatedNextRun = new Date(nextRun);
      if (rule.frequency === "MONTHLY") {
        updatedNextRun.setMonth(updatedNextRun.getMonth() + rule.interval);
      } else if (rule.frequency === "WEEKLY") {
        updatedNextRun.setDate(updatedNextRun.getDate() + 7 * rule.interval);
      } else if (rule.frequency === "YEARLY") {
        updatedNextRun.setFullYear(updatedNextRun.getFullYear() + rule.interval);
      }

      await db.recurrenceRule.update({
        where: { id: rule.id },
        data: {
          nextRunAt: updatedNextRun,
        },
      });

      generatedCount++;
    }

    return { success: true, generatedCount };
  } catch (error: any) {
    console.error("Erro ao processar job de recorrências:", error);
    return { success: false, error: error.message };
  }
}
