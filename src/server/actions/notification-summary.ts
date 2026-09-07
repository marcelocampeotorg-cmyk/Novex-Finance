"use server";

import { db } from "@/server/db";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export interface LiveAlertItem {
  id: string;
  type: "OVERDUE" | "DUE_TODAY" | "WHATSAPP_SENT" | "PAYMENT_RECEIVED";
  title: string;
  description: string;
  amountCents?: number;
  contactName?: string;
  occurredAt?: string;
}

export async function getLiveDashboardAlerts(): Promise<{
  success: boolean;
  alerts: LiveAlertItem[];
}> {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const alerts: LiveAlertItem[] = [];

    // 1. Contas a Receber Atrasadas ou Vencendo Hoje
    const pendingReceivables = await db.installment.findMany({
      where: {
        financialItem: {
          workspaceId,
          direction: "RECEIVABLE",
          deletedAt: null,
        },
        status: { in: ["SCHEDULED", "OVERDUE", "PARTIAL"] },
        dueDate: { lte: endOfToday },
      },
      include: {
        financialItem: {
          include: { contact: true },
        },
        pixCharges: {
          where: { status: { in: ["PENDING", "ACTION_REQUIRED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        whatsAppLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { dueDate: "asc" },
      take: 3,
    });

    for (const inst of pendingReceivables) {
      const remainingCents = Number(inst.amountCents) - Number(inst.settledAmountCents);
      const isOverdue = inst.dueDate < startOfToday;
      const contactName = inst.financialItem.contact?.name || "Cliente";
      const lastWa = inst.whatsAppLogs[0];

      let waStatus = "Cobrança via WhatsApp pronta para disparo.";
      if (lastWa?.status === "SENT") {
        waStatus = `Cobrança via WhatsApp já enviada em ${new Date(lastWa.sentAt || lastWa.createdAt).toLocaleDateString("pt-BR")}.`;
      } else if (lastWa?.status === "SENDING") {
        waStatus = "Cobrança via WhatsApp sendo disparada agora.";
      }

      alerts.push({
        id: `inst-${inst.id}`,
        type: isOverdue ? "OVERDUE" : "DUE_TODAY",
        title: isOverdue ? `Atraso: ${contactName}` : `Vence Hoje: ${contactName}`,
        description: `${inst.financialItem.title} · ${waStatus}`,
        amountCents: remainingCents,
        contactName,
        occurredAt: inst.dueDate.toISOString(),
      });
    }

    // 2. Últimos Pagamentos Recebidos (últimas 24h)
    const recentCredits = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        direction: "CREDIT",
        status: "APPROVED",
        quarantinedAt: null,
        occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { occurredAt: "desc" },
      take: 2,
    });

    for (const tx of recentCredits) {
      alerts.push({
        id: `credit-${tx.id}`,
        type: "PAYMENT_RECEIVED",
        title: "Pagamento Confirmado!",
        description: tx.description || "Crédito conciliado no saldo.",
        amountCents: Number(tx.amountCents),
        contactName: tx.counterpartName || undefined,
        occurredAt: tx.occurredAt.toISOString(),
      });
    }

    return { success: true, alerts };
  } catch (error: any) {
    console.error("Erro ao carregar alertas ao vivo do painel:", error);
    return { success: false, alerts: [] };
  }
}
