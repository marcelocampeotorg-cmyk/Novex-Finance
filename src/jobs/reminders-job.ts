import { db } from "@/server/db";

const DEMO_WORKSPACE_ID = "ws-personal-demo";

export interface ActiveReminderNotice {
  installmentId: string;
  title: string;
  amountCents: number;
  dueDate: string;
  daysDiff: number;
  noticeType: "DAYS_BEFORE" | "DUE_TODAY" | "OVERDUE";
}

/**
 * Processador de Lembretes e Alertas de Vencimento
 */
export async function processRemindersJob(): Promise<ActiveReminderNotice[]> {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const installments = await db.installment.findMany({
      where: {
        financialItem: {
          workspaceId: DEMO_WORKSPACE_ID,
          deletedAt: null,
        },
        status: { in: ["SCHEDULED", "OVERDUE", "PARTIAL"] },
      },
      include: {
        financialItem: true,
      },
    });

    const notices: ActiveReminderNotice[] = [];

    for (const inst of installments) {
      const due = new Date(inst.dueDate);
      due.setHours(0, 0, 0, 0);

      const diffMs = due.getTime() - now.getTime();
      const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        notices.push({
          installmentId: inst.id,
          title: inst.financialItem.title,
          amountCents: Number(inst.amountCents - inst.settledAmountCents),
          dueDate: inst.dueDate.toISOString(),
          daysDiff: 0,
          noticeType: "DUE_TODAY",
        });
      } else if (daysDiff > 0 && daysDiff <= 7) {
        notices.push({
          installmentId: inst.id,
          title: inst.financialItem.title,
          amountCents: Number(inst.amountCents - inst.settledAmountCents),
          dueDate: inst.dueDate.toISOString(),
          daysDiff,
          noticeType: "DAYS_BEFORE",
        });
      } else if (daysDiff < 0) {
        notices.push({
          installmentId: inst.id,
          title: inst.financialItem.title,
          amountCents: Number(inst.amountCents - inst.settledAmountCents),
          dueDate: inst.dueDate.toISOString(),
          daysDiff: Math.abs(daysDiff),
          noticeType: "OVERDUE",
        });
      }
    }

    return notices;
  } catch (error) {
    console.error("Erro ao verificar lembretes:", error);
    return [];
  }
}
