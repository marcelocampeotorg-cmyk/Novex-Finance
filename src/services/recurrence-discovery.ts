import "server-only";
import { db } from "@/server/db";
import { detectMonthlyRecurrences } from "@/services/recurrence-detector";

export async function discoverWorkspaceRecurrences(workspaceId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 180);
  const transactions = await db.externalTransaction.findMany({
    where: { workspaceId, quarantinedAt: null, occurredAt: { gte: since }, direction: "DEBIT" },
    select: { id: true, description: true, occurredAt: true, amountCents: true },
  });
  const suggestions = detectMonthlyRecurrences(transactions.map((tx) => ({ ...tx, amountCents: Number(tx.amountCents) })));
  for (const suggestion of suggestions) {
    await db.notificationEvent.upsert({
      where: { dedupeKey: `recurrence:${workspaceId}:${suggestion.pattern}` },
      update: { metadata: suggestion, message: `Padrão mensal provável com ${suggestion.confidence}% de confiança.` },
      create: {
        workspaceId, type: "RECURRENCE_SUGGESTION", title: "Recorrência provável detectada",
        message: `Padrão mensal provável com ${suggestion.confidence}% de confiança. Confirme antes de criar um compromisso.`,
        dedupeKey: `recurrence:${workspaceId}:${suggestion.pattern}`, metadata: suggestion,
      },
    });
  }
  return suggestions;
}
