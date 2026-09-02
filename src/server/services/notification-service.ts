import "server-only";

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

export async function getNotificationRuleForWorkspace(targetWorkspaceId?: string) {
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
export async function processNotificationAlertsForWorkspace(targetWorkspaceId?: string): Promise<NotificationAlert[]> {
  const workspaceId = targetWorkspaceId || (await requireAuthenticatedWorkspace()).workspaceId;
  const rule = await getNotificationRuleForWorkspace(workspaceId);
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
    
    // Item 13: Calcular o saldo remanescente da parcela (amountCents - settledAmountCents)
    const remainingAmountCents = Number(inst.amountCents - inst.settledAmountCents);
    if (remainingAmountCents <= 0) continue;

    let alertType: "DUE_SOON" | "DUE_TODAY" | "OVERDUE" | null = null;
    let stageKey = "";
    let message = "";

    if (daysDiff < 0 || inst.status === "OVERDUE") {
      const overdueDays = Math.abs(daysDiff);
      // Item 13: Aplicar overdueFrequency (ex: a cada N dias de atraso)
      const freq = rule.overdueFrequency > 0 ? rule.overdueFrequency : 1;
      if (overdueDays === 1 || overdueDays % freq === 0) {
        alertType = "OVERDUE";
        stageKey = `OVERDUE_${overdueDays}D`;
        message = `${direction === "PAYABLE" ? "Conta a pagar" : "Cobrança"} de R$ ${(remainingAmountCents / 100).toFixed(2)} está atrasada há ${overdueDays} dia(s).`;
      }
    } else if (daysDiff === 0 && rule.onDueDate) {
      alertType = "DUE_TODAY";
      stageKey = "DUE_TODAY";
      message = `${direction === "PAYABLE" ? "Conta a pagar" : "Cobrança"} de R$ ${(remainingAmountCents / 100).toFixed(2)} vence HOJE.`;
    } else if (daysDiff > 0 && rule.daysBefore.includes(daysDiff)) {
      alertType = "DUE_SOON";
      // Item 13: Chaves distintas para estágios 7d, 3d, 1d (evita deduplicação indevida entre estágios)
      stageKey = `DUE_SOON_${daysDiff}D`;
      message = `${direction === "PAYABLE" ? "Conta a pagar" : "Cobrança"} de R$ ${(remainingAmountCents / 100).toFixed(2)} vence em ${daysDiff} dia(s).`;
    }

    if (alertType && stageKey) {
      const alertId = `ALERT-${stageKey}-${inst.id}`;
      alerts.push({
        id: alertId,
        installmentId: inst.id,
        financialItemId: inst.financialItemId,
        title,
        contactName,
        amountCents: remainingAmountCents,
        dueDate: inst.dueDate.toISOString(),
        direction,
        type: alertType,
        message,
        daysDiff: Math.abs(daysDiff),
      });

      // Item 13: dedupeKey único por estágio (ex: event_ws_instId_DUE_SOON_7D)
      const dedupeKey = `event_${workspaceId}_${inst.id}_${stageKey}`;
      await db.notificationEvent.upsert({
        where: { dedupeKey },
        update: { message },
        create: {
          workspaceId,
          type: alertType,
          title,
          message,
          dedupeKey,
          metadata: { installmentId: inst.id, amountCents: remainingAmountCents },
        },
      });
    }
  }

  return alerts;
}

/**
 * Resolver de credenciais server-side da Evolution API
 */
async function resolveEvolutionCredentials(workspaceId: string) {
  const integration = await db.integrationAccount.findFirst({
    where: { workspaceId, provider: "EVOLUTION_API", isActive: true },
  });

  if (integration && integration.encryptedCredentials) {
    try {
      const rawData = decryptCredentials(integration.encryptedCredentials);
      const parsed = JSON.parse(rawData);
      if (parsed.baseUrl && parsed.apiKey && parsed.instanceName) {
        return {
          baseUrl: parsed.baseUrl as string,
          apiKey: parsed.apiKey as string,
          instanceName: parsed.instanceName as string,
        };
      }
    } catch (e) {
      // Fallback para variáveis de ambiente se a descriptografia falhar
    }
  }

  const baseUrl = process.env.EVOLUTION_API_URL || (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:8081" : "");
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || (process.env.NODE_ENV !== "production" ? "novex-finance" : "");
  if (!baseUrl || !apiKey || !instanceName) {
    throw new Error("Configuração da Evolution API incompleta: informe base URL, API key e instância.");
  }

  return { baseUrl, apiKey, instanceName };
}

/**
 * Consultar estado de conexão real da instância na Evolution API (Servidor resolve credenciais)
 */
export async function checkEvolutionConnectionState() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const creds = await resolveEvolutionCredentials(workspaceId);
    const { evolutionAPIClient } = await import("@/integrations/evolution-api/client");
    const result = await evolutionAPIClient.checkConnectionState(creds.baseUrl, creds.apiKey, creds.instanceName);

    return result;
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
export type WhatsAppReminderStage = "MANUAL" | "DUE" | "OVERDUE" | `DUE_SOON_${number}D`;

async function sendWhatsAppDebtorReminderForWorkspace(
  workspaceId: string,
  input: { pixChargeId: string; messageStage: WhatsAppReminderStage },
) {
  try {
    const charge = await db.pixCharge.findFirst({
      where: { id: input.pixChargeId, workspaceId },
      include: { installment: { include: { financialItem: { include: { contact: true } } } } },
    });
    if (!charge?.qrCode || !charge.installment.financialItem.contact?.phone) throw new Error("Cobrança Pix/telefone reais não encontrados.");

    const creds = await resolveEvolutionCredentials(workspaceId);
    const { evolutionAPIClient } = await import("@/integrations/evolution-api/client");
    const connection = await evolutionAPIClient.checkConnectionState(creds.baseUrl, creds.apiKey, creds.instanceName);
    if (!connection.success || connection.state !== "open") {
      return { success: false, error: connection.error || "WhatsApp ainda não está conectado (estado open ausente)." };
    }
    const safeSettings = await evolutionAPIClient.ensureOutboundOnlySettings(creds.baseUrl, creds.apiKey, creds.instanceName);
    if (!safeSettings.success) {
      return { success: false, error: safeSettings.error || "Não foi possível aplicar as configurações seguras da instância." };
    }

    const dedupeKey = `whatsapp:${workspaceId}:${charge.id}:${input.messageStage}`;

    // Item 3: Atomic claim exclusivity
    const existingLog = await db.whatsAppDeliveryLog.findUnique({ where: { dedupeKey } });

    if (existingLog) {
      if (existingLog.status === "SENT" || existingLog.status === "DELIVERED") {
        return { success: true, messageId: existingLog.remoteMessageId, alreadySent: true };
      }
      if (existingLog.status === "SENDING") {
        const leaseExpired = existingLog.lastAttemptAt.getTime() <= Date.now() - 10 * 60 * 1000;
        if (!leaseExpired) return { success: false, error: "Envio de cobrança já em andamento por outro processo." };
        const reclaimed = await db.whatsAppDeliveryLog.updateMany({
          where: { dedupeKey, status: "SENDING", lastAttemptAt: existingLog.lastAttemptAt },
          data: { lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
        });
        if (reclaimed.count === 0) return { success: false, error: "Outra tentativa retomou este envio." };
      }
      if (existingLog.status === "FAILED") {
        if (existingLog.attemptCount >= 3) return { success: false, error: "Limite de 3 tentativas atingido; reenvio manual necessário." };
        if (existingLog.nextRetryAt && existingLog.nextRetryAt > new Date()) {
          return { success: false, error: `Nova tentativa permitida após ${existingLog.nextRetryAt.toISOString()}.` };
        }
        // Transição atômica FAILED -> SENDING
        const claim = await db.whatsAppDeliveryLog.updateMany({
          where: { dedupeKey, status: "FAILED", attemptCount: { lt: 3 } },
          data: { status: "SENDING", attemptCount: { increment: 1 }, lastAttemptAt: new Date(), nextRetryAt: null },
        });
        if (claim.count === 0) {
          return { success: false, error: "Outra tentativa de envio já foi iniciada por outro processo." };
        }
      }
    } else {
      // Ausência de log -> Criar SENDING atômico
      try {
        await db.whatsAppDeliveryLog.create({
          data: {
            workspaceId,
            recipientPhone: charge.installment.financialItem.contact.phone,
            chargeId: charge.id,
            installmentId: charge.installmentId,
            messageType: input.messageStage,
            dedupeKey,
            status: "SENDING",
            attemptCount: 1,
            lastAttemptAt: new Date(),
          },
        });
      } catch (e: any) {
        if (e.code === "P2002") {
          return { success: false, error: "Concorrência: outro envio foi iniciado por outro processo." };
        }
        throw e;
      }
    }

    const result = await evolutionAPIClient.sendPixChargeReminder({
      debtorName: charge.installment.financialItem.contact.name,
      debtorPhone: charge.installment.financialItem.contact.phone,
      amountCents: Number(charge.amountCents),
      dueDate: charge.installment.dueDate.toLocaleDateString("pt-BR"),
      pixCopiaECola: charge.qrCode,
      baseUrl: creds.baseUrl,
      apiKey: creds.apiKey,
      instanceName: creds.instanceName,
    });

    // Atualizar resultado final do envio
    await db.whatsAppDeliveryLog.update({
      where: { dedupeKey },
      data: {
        remoteMessageId: result.messageId || null,
        status: result.success ? "SENT" : "FAILED",
        errorMessage: result.success ? null : result.error || "Falha no envio",
        nextRetryAt: result.success ? null : new Date(Date.now() + 15 * 60 * 1000),
        sentAt: result.success ? new Date() : undefined,
      },
    });

    return result;
  } catch (error: any) {
    console.error("Erro ao enviar lembrete WhatsApp:", error);
    return { success: false, error: error.message };
  }
}

export async function sendWhatsAppDebtorReminder(input: { pixChargeId: string; messageStage: WhatsAppReminderStage }) {
  const { workspaceId } = await requireAuthenticatedWorkspace();
  return sendWhatsAppDebtorReminderForWorkspace(workspaceId, input);
}

export async function processAutomaticWhatsAppCollectionsForWorkspace(
  workspaceId: string,
  alerts?: NotificationAlert[],
) {
  const rule = await getNotificationRuleForWorkspace(workspaceId);
  if (!rule.enabled || !rule.channels.includes("WHATSAPP")) return { attempted: 0, sent: 0, failed: 0 };

  const localHour = Number(new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).format(new Date()));
  if (localHour < rule.hour) return { attempted: 0, sent: 0, failed: 0 };

  const eligibleAlerts = (alerts || await processNotificationAlertsForWorkspace(workspaceId))
    .filter((alert) => alert.direction === "RECEIVABLE");
  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const alert of eligibleAlerts) {
    const charge = await db.pixCharge.findFirst({
      where: {
        workspaceId,
        installmentId: alert.installmentId,
        status: { in: ["PENDING", "ACTION_REQUIRED"] },
        qrCode: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!charge) continue;

    const messageStage: WhatsAppReminderStage = alert.type === "OVERDUE"
      ? "OVERDUE"
      : alert.type === "DUE_TODAY"
      ? "DUE"
      : `DUE_SOON_${alert.daysDiff}D`;
    attempted++;
    const result = await sendWhatsAppDebtorReminderForWorkspace(workspaceId, { pixChargeId: charge.id, messageStage });
    if (result.success) sent++;
    else failed++;
  }

  return { attempted, sent, failed };
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
      dedupeKey: `whatsapp-test:${workspaceId}:${input.phone}:${new Date().toISOString().slice(0, 10)}`,
      remoteMessageId: result.messageId || null, status: result.success ? "SENT" : "FAILED",
      errorMessage: result.success ? null : result.error || "Falha no envio",
      sentAt: result.success ? new Date() : null,
    }});
    return result;
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}
