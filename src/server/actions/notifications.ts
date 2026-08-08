"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export interface NotificationRuleInput {
  daysBefore: number[];
  onDueDate: boolean;
  overdueFrequency: number;
  hour: number;
  channels: string[];
}

export interface NotificationAlert {
  id: string;
  installmentId: string;
  financialItemId: string;
  title: string;
  contactName?: string;
  amountCents: number;
  dueDate: string;
  direction: "PAYABLE" | "RECEIVABLE";
  type: "DUE_SOON" | "DUE_TODAY" | "OVERDUE";
  message: string;
  daysDiff: number;
}

export async function getNotificationRule() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    let rule = await db.notificationRule.findFirst({
      where: { workspaceId, scope: "GLOBAL" },
    });

    if (!rule) {
      rule = await db.notificationRule.create({
        data: {
          workspaceId,
          scope: "GLOBAL",
          daysBefore: [7, 3, 1],
          onDueDate: true,
          overdueFrequency: 1,
          hour: 9,
          channels: ["DASHBOARD"],
          enabled: true,
        },
      });
    }

    return {
      id: rule.id,
      daysBefore: rule.daysBefore,
      onDueDate: rule.onDueDate,
      overdueFrequency: rule.overdueFrequency,
      hour: rule.hour,
      channels: rule.channels,
      enabled: rule.enabled,
    };
  } catch (error) {
    console.error("Erro ao buscar regra de notificação:", error);
    return {
      daysBefore: [7, 3, 1],
      onDueDate: true,
      overdueFrequency: 1,
      hour: 9,
      channels: ["DASHBOARD"],
      enabled: true,
    };
  }
}

export async function updateNotificationRule(input: NotificationRuleInput) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    let rule = await db.notificationRule.findFirst({
      where: { workspaceId, scope: "GLOBAL" },
    });

    if (rule) {
      await db.notificationRule.update({
        where: { id: rule.id },
        data: {
          daysBefore: input.daysBefore,
          onDueDate: input.onDueDate,
          overdueFrequency: input.overdueFrequency,
          hour: input.hour,
          channels: input.channels,
        },
      });
    } else {
      await db.notificationRule.create({
        data: {
          workspaceId,
          scope: "GLOBAL",
          daysBefore: input.daysBefore,
          onDueDate: input.onDueDate,
          overdueFrequency: input.overdueFrequency,
          hour: input.hour,
          channels: input.channels,
          enabled: true,
        },
      });
    }

    revalidatePath("/lembretes");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao atualizar regra de notificação:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Avalia parcelas financeiras ativas e gera alertas de notificação em tempo real
 */
export async function processNotificationAlerts(): Promise<NotificationAlert[]> {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const rule = await getNotificationRule();
    const now = new Date();

    const installments = await db.installment.findMany({
      where: {
        financialItem: {
          workspaceId,
          deletedAt: null,
        },
        status: { in: ["SCHEDULED", "OVERDUE", "PARTIAL"] },
      },
      include: {
        financialItem: {
          include: { contact: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const alerts: NotificationAlert[] = [];

    for (const inst of installments) {
      const timeDiff = inst.dueDate.getTime() - now.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      const title = inst.financialItem.title;
      const contactName = inst.financialItem.contact?.name;
      const direction = inst.financialItem.direction;
      const amountCents = Number(inst.amountCents);

      // 1. Atrasado (Overdue)
      if (daysDiff < 0 || inst.status === "OVERDUE") {
        alerts.push({
          id: `ALERT-OVERDUE-${inst.id}`,
          installmentId: inst.id,
          financialItemId: inst.financialItemId,
          title,
          contactName,
          amountCents,
          dueDate: inst.dueDate.toISOString(),
          direction,
          type: "OVERDUE",
          message: `${direction === "PAYABLE" ? "Conta a pagar" : "Cobrança"} de R$ ${(amountCents / 100).toFixed(
            2
          )} está atrasada há ${Math.abs(daysDiff)} dia(s).`,
          daysDiff: Math.abs(daysDiff),
        });
      }
      // 2. Vencimento Hoje (Due Today)
      else if (daysDiff === 0 && rule.onDueDate) {
        alerts.push({
          id: `ALERT-TODAY-${inst.id}`,
          installmentId: inst.id,
          financialItemId: inst.financialItemId,
          title,
          contactName,
          amountCents,
          dueDate: inst.dueDate.toISOString(),
          direction,
          type: "DUE_TODAY",
          message: `${direction === "PAYABLE" ? "Conta a pagar" : "Cobrança"} de R$ ${(amountCents / 100).toFixed(
            2
          )} vence HOJE.`,
          daysDiff: 0,
        });
      }
      // 3. Pré-vencimento (Due Soon)
      else if (daysDiff > 0 && rule.daysBefore.includes(daysDiff)) {
        alerts.push({
          id: `ALERT-SOON-${inst.id}`,
          installmentId: inst.id,
          financialItemId: inst.financialItemId,
          title,
          contactName,
          amountCents,
          dueDate: inst.dueDate.toISOString(),
          direction,
          type: "DUE_SOON",
          message: `${direction === "PAYABLE" ? "Conta a pagar" : "Cobrança"} de R$ ${(amountCents / 100).toFixed(
            2
          )} vence em ${daysDiff} dia(s).`,
          daysDiff,
        });
      }
    }

    return alerts;
  } catch (error) {
    console.error("Erro ao processar alertas de notificação:", error);
    return [];
  }
}

/**
 * Consultar estado de conexão real da instância na Evolution API
 */
export async function checkEvolutionConnectionState(input?: { baseUrl?: string; apiKey?: string; instanceName?: string }) {
  try {
    const { evolutionAPIClient } = await import("@/integrations/evolution-api/client");
    return await evolutionAPIClient.checkConnectionState(input?.baseUrl, input?.apiKey, input?.instanceName);
  } catch (error: any) {
    return { success: false, state: "disconnected" as const, error: error.message };
  }
}

/**
 * Solicitar QR Code real de conexão junto à Evolution API
 */
export async function fetchEvolutionQRCode(input?: { baseUrl?: string; apiKey?: string; instanceName?: string }) {
  try {
    const { evolutionAPIClient } = await import("@/integrations/evolution-api/client");
    return await evolutionAPIClient.fetchQRCode(input?.baseUrl, input?.apiKey, input?.instanceName);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Disparar lembrete ou cobrança de devedor via WhatsApp (Evolution API)
 */
export async function sendWhatsAppDebtorReminder(input: {
  debtorName: string;
  debtorPhone: string;
  amountCents: number;
  dueDate: string;
  pixCopiaECola?: string;
  baseUrl?: string;
  apiKey?: string;
  instanceName?: string;
}) {
  try {
    const { evolutionAPIClient } = await import("@/integrations/evolution-api/client");
    return await evolutionAPIClient.sendPixChargeReminder(input);
  } catch (error: any) {
    console.error("Erro ao enviar lembrete WhatsApp:", error);
    return { success: false, error: error.message };
  }
}
