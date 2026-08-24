"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { decryptCredentials } from "@/lib/server/credentials-crypto";

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

export async function getNotificationRule(targetWorkspaceId?: string) {
  const workspaceId = targetWorkspaceId || (await requireAuthenticatedWorkspace()).workspaceId;

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
export async function processNotificationAlerts(targetWorkspaceId?: string): Promise<NotificationAlert[]> {
  const workspaceId = targetWorkspaceId || (await requireAuthenticatedWorkspace()).workspaceId;
  const rule = await getNotificationRule(workspaceId);
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

    let alertType: "DUE_SOON" | "DUE_TODAY" | "OVERDUE" | null = null;
    let message = "";

    if (daysDiff < 0 || inst.status === "OVERDUE") {
      alertType = "OVERDUE";
      message = `${direction === "PAYABLE" ? "Conta a pagar" : "Cobrança"} de R$ ${(amountCents / 100).toFixed(2)} está atrasada há ${Math.abs(daysDiff)} dia(s).`;
    } else if (daysDiff === 0 && rule.onDueDate) {
      alertType = "DUE_TODAY";
      message = `${direction === "PAYABLE" ? "Conta a pagar" : "Cobrança"} de R$ ${(amountCents / 100).toFixed(2)} vence HOJE.`;
    } else if (daysDiff > 0 && rule.daysBefore.includes(daysDiff)) {
      alertType = "DUE_SOON";
      message = `${direction === "PAYABLE" ? "Conta a pagar" : "Cobrança"} de R$ ${(amountCents / 100).toFixed(2)} vence em ${daysDiff} dia(s).`;
    }

    if (alertType) {
      const alertId = `ALERT-${alertType}-${inst.id}`;
      alerts.push({
        id: alertId,
        installmentId: inst.id,
        financialItemId: inst.financialItemId,
        title,
        contactName,
        amountCents,
        dueDate: inst.dueDate.toISOString(),
        direction,
        type: alertType,
        message,
        daysDiff: Math.abs(daysDiff),
      });

      // Regra 39: Notificação no banco persistente sem duplicação
      const dedupeKey = `event_${workspaceId}_${inst.id}_${alertType}`;
      try {
        await db.notificationEvent.upsert({
          where: { dedupeKey },
          update: { message },
          create: {
            workspaceId,
            type: alertType,
            title,
            message,
            dedupeKey,
            metadata: { installmentId: inst.id, amountCents },
          },
        });
      } catch (e) {}
    }
  }

  return alerts;
}

/**
 * Resolver de credenciais server-side da Evolution API
 */
async function resolveEvolutionCredentials(workspaceId: string) {
  const integration = await db.integrationAccount.findFirst({
    where: { workspaceId, provider: "EVOLUTION_API", status: "CONNECTED" },
  });

  if (!integration || !integration.encryptedCredentials) {
    throw new Error("Integração do WhatsApp (Evolution API) não configurada ou desconectada.");
  }

  const rawData = decryptCredentials(integration.encryptedCredentials);
  const parsed = JSON.parse(rawData);

  if (!parsed.baseUrl || !parsed.apiKey || !parsed.instanceName) {
    throw new Error("Configuração da Evolution API incompleta.");
  }

  return {
    baseUrl: parsed.baseUrl,
    apiKey: parsed.apiKey,
    instanceName: parsed.instanceName,
  };
}

/**
 * Consultar estado de conexão real da instância na Evolution API (Servidor resolve credenciais)
 */
export async function checkEvolutionConnectionState() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const creds = await resolveEvolutionCredentials(workspaceId);
    const { evolutionAPIClient } = await import("@/integrations/evolution-api/client");
    return await evolutionAPIClient.checkConnectionState(creds.baseUrl, creds.apiKey, creds.instanceName);
  } catch (error: any) {
    return { success: false, state: "disconnected" as const, error: error.message };
  }
}

/**
 * Solicitar QR Code real de conexão junto à Evolution API (Servidor resolve credenciais)
 */
export async function fetchEvolutionQRCode() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const creds = await resolveEvolutionCredentials(workspaceId);
    const { evolutionAPIClient } = await import("@/integrations/evolution-api/client");
    return await evolutionAPIClient.fetchQRCode(creds.baseUrl, creds.apiKey, creds.instanceName);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Disparar lembrete ou cobrança de devedor via WhatsApp (Regras 35 & 38: Servidor resolve credenciais e registra em WhatsAppDeliveryLog)
 */
export async function sendWhatsAppDebtorReminder(input: {
  debtorName: string;
  debtorPhone: string;
  amountCents: number;
  dueDate: string;
  pixCopiaECola?: string;
  chargeId?: string;
  installmentId?: string;
  messageType?: string;
}) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const creds = await resolveEvolutionCredentials(workspaceId);
    const { evolutionAPIClient } = await import("@/integrations/evolution-api/client");

    const result = await evolutionAPIClient.sendPixChargeReminder({
      debtorName: input.debtorName,
      debtorPhone: input.debtorPhone,
      amountCents: input.amountCents,
      dueDate: input.dueDate,
      pixCopiaECola: input.pixCopiaECola,
      baseUrl: creds.baseUrl,
      apiKey: creds.apiKey,
      instanceName: creds.instanceName,
    });

    // Regra 38: Registrar Log de Envio em whatsapp_delivery_logs
    await db.whatsAppDeliveryLog.create({
      data: {
        workspaceId,
        recipientPhone: input.debtorPhone,
        chargeId: input.chargeId || null,
        installmentId: input.installmentId || null,
        messageType: input.messageType || "PIX_REMINDER",
        remoteMessageId: result.messageId || null,
        status: result.success ? "SENT" : "FAILED",
        errorMessage: result.success ? null : result.error || "Falha no envio",
      },
    });

    return result;
  } catch (error: any) {
    console.error("Erro ao enviar lembrete WhatsApp:", error);
    return { success: false, error: error.message };
  }
}

export async function sendNeutralWhatsAppTest(input: { phone: string }) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const creds = await resolveEvolutionCredentials(workspaceId);
    const { evolutionAPIClient } = await import("@/integrations/evolution-api/client");
    const result = await evolutionAPIClient.sendTextMessage({
      number: input.phone,
      text: "Mensagem de teste do NOVEX Finance. Sua integração com o WhatsApp está funcionando.",
      baseUrl: creds.baseUrl,
      apiKey: creds.apiKey,
      instanceName: creds.instanceName,
    });
    await db.whatsAppDeliveryLog.create({ data: {
      workspaceId, recipientPhone: input.phone, messageType: "CONNECTION_TEST",
      remoteMessageId: result.messageId || null, status: result.success ? "SENT" : "FAILED",
      errorMessage: result.success ? null : result.error || "Falha no envio",
    }});
    return result;
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}
