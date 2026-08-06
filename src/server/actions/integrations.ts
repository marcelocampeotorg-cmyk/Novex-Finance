"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace, requireWorkspaceRole } from "@/server/auth-context";
import {
  encryptCredentials,
  decryptCredentials,
  validateTokenLocalFormat,
  maskAccessToken,
} from "@/lib/server/credentials-crypto";
import { validateAccessToken } from "@/integrations/mercado-pago/credentials-validator";

const saveCredentialsSchema = z.object({
  accessToken: z.string().min(10).max(512),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
});

export interface IntegrationStatusResult {
  isConnected: boolean;
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";
  environment: string;
  maskedToken?: string;
  lastValidatedAt?: string;
  lastValidationErrorCode?: string;
  externalAccountId?: string;
  canManage: boolean;
}

/**
 * Retorna o status sanitizado da integração do Mercado Pago para o workspace autenticado.
 */
export async function getMercadoPagoIntegrationStatus(): Promise<IntegrationStatusResult> {
  const context = await requireAuthenticatedWorkspace();
  const isAdmin = ["OWNER", "ADMIN"].includes(context.role);

  const integration = await db.integrationAccount.findFirst({
    where: {
      workspaceId: context.workspaceId,
      provider: "MERCADO_PAGO",
      environment: "SANDBOX",
    },
  });

  if (!integration || !integration.encryptedCredentials || integration.status === "DISCONNECTED") {
    return {
      isConnected: false,
      status: "DISCONNECTED",
      environment: "SANDBOX",
      canManage: isAdmin,
    };
  }

  let maskedToken: string | undefined = undefined;
  if (isAdmin && integration.encryptedCredentials) {
    try {
      const rawToken = decryptCredentials(integration.encryptedCredentials);
      maskedToken = maskAccessToken(rawToken);
    } catch (e) {
      maskedToken = "••••••••••••";
    }
  }

  return {
    isConnected: integration.status === "CONNECTED",
    status: (integration.status as any) || "DISCONNECTED",
    environment: integration.environment,
    maskedToken,
    lastValidatedAt: integration.lastValidatedAt?.toISOString(),
    lastValidationErrorCode: integration.lastValidationErrorCode || undefined,
    externalAccountId: integration.externalAccountId || undefined,
    canManage: isAdmin,
  };
}

/**
 * Salva ou substitui credenciais do Mercado Pago (Sandbox) de forma atômica.
 * Exige papel OWNER ou ADMIN.
 */
export async function saveMercadoPagoCredentials(input: { accessToken: string; environment?: "SANDBOX" | "PRODUCTION" }) {
  const context = await requireWorkspaceRole(["OWNER", "ADMIN"]);

  const parsed = saveCredentialsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Formato de token inválido ou parâmetro incorreto." };
  }

  const { accessToken, environment } = parsed.data;

  // Aceitar somente ambiente SANDBOX neste marco conforme especificação
  if (environment !== "SANDBOX") {
    return { success: false, error: "Apenas o ambiente SANDBOX é permitido neste marco." };
  }

  // 1. Validação local do formato
  const localCheck = validateTokenLocalFormat(accessToken);
  if (!localCheck.valid) {
    return { success: false, error: localCheck.reason || "Formato de token inválido." };
  }

  // 2. Validação remota com AbortController em https://api.mercadolibre.com/users/me
  const validation = await validateAccessToken(accessToken);

  if (!validation.valid) {
    // Gravar falha em AuditLog sem alterar credenciais válidas anteriores
    await db.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorType: "USER",
        actorId: context.userId,
        action: "MP_CONNECTION_FAILED",
        entityType: "IntegrationAccount",
        entityId: "MERCADO_PAGO_SANDBOX",
        metadata: {
          errorCode: validation.errorCode,
          environment,
        },
      },
    });

    return {
      success: false,
      error: validation.errorMessage || "Não foi possível validar o Access Token junto ao Mercado Pago.",
      errorCode: validation.errorCode,
    };
  }

  // 3. Criptografia AES-256-GCM
  const encryptedCredentials = encryptCredentials(accessToken);
  const masked = maskAccessToken(accessToken);

  // 4. Salvar de forma atômica no banco de dados
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.integrationAccount.findFirst({
      where: {
        workspaceId: context.workspaceId,
        provider: "MERCADO_PAGO",
        environment: "SANDBOX",
      },
    });

    const isReplacement = !!existing && existing.status === "CONNECTED";

    const account = await tx.integrationAccount.upsert({
      where: {
        workspaceId_provider_environment: {
          workspaceId: context.workspaceId,
          provider: "MERCADO_PAGO",
          environment: "SANDBOX",
        },
      },
      update: {
        encryptedCredentials,
        externalAccountId: validation.externalAccountId || null,
        externalApplicationId: validation.externalApplicationId || null,
        status: "CONNECTED",
        lastValidatedAt: new Date(),
        lastValidationErrorCode: null,
      },
      create: {
        workspaceId: context.workspaceId,
        provider: "MERCADO_PAGO",
        environment: "SANDBOX",
        displayName: "Mercado Pago Sandbox",
        encryptedCredentials,
        externalAccountId: validation.externalAccountId || null,
        externalApplicationId: validation.externalApplicationId || null,
        status: "CONNECTED",
        lastValidatedAt: new Date(),
      },
    });

    // Registra AuditLog sanitizado
    await tx.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorType: "USER",
        actorId: context.userId,
        action: isReplacement ? "MP_CREDENTIAL_REPLACED" : "MP_CREDENTIAL_SAVED",
        entityType: "IntegrationAccount",
        entityId: account.id,
        metadata: {
          environment: "SANDBOX",
          externalAccountId: validation.externalAccountId,
          maskedToken: masked,
        },
      },
    });

    return account;
  });

  revalidatePath("/configuracoes");

  return {
    success: true,
    maskedToken: masked,
    status: "CONNECTED",
    lastValidatedAt: result.lastValidatedAt?.toISOString(),
  };
}

/**
 * Valida novamente a conexão atual salva no banco.
 * Exige papel OWNER ou ADMIN.
 */
export async function validateMercadoPagoConnection() {
  const context = await requireWorkspaceRole(["OWNER", "ADMIN"]);

  const integration = await db.integrationAccount.findFirst({
    where: {
      workspaceId: context.workspaceId,
      provider: "MERCADO_PAGO",
      environment: "SANDBOX",
    },
  });

  if (!integration || !integration.encryptedCredentials) {
    return { success: false, error: "Nenhuma credencial configurada no workspace." };
  }

  let token: string;
  try {
    token = decryptCredentials(integration.encryptedCredentials);
  } catch (e) {
    return { success: false, error: "Erro ao descriptografar credenciais do servidor." };
  }

  const validation = await validateAccessToken(token);

  await db.integrationAccount.update({
    where: { id: integration.id },
    data: {
      status: validation.valid ? "CONNECTED" : "ERROR",
      lastValidatedAt: new Date(),
      lastValidationErrorCode: validation.valid ? null : validation.errorCode,
    },
  });

  await db.auditLog.create({
    data: {
      workspaceId: context.workspaceId,
      actorType: "USER",
      actorId: context.userId,
      action: validation.valid ? "MP_CONNECTION_VALIDATED" : "MP_CONNECTION_FAILED",
      entityType: "IntegrationAccount",
      entityId: integration.id,
      metadata: {
        valid: validation.valid,
        errorCode: validation.errorCode,
      },
    },
  });

  revalidatePath("/configuracoes");

  return {
    success: validation.valid,
    status: validation.valid ? "CONNECTED" : "ERROR",
    errorMessage: validation.errorMessage,
    lastValidatedAt: new Date().toISOString(),
  };
}

/**
 * Desconecta a integração do Mercado Pago sem apagar transações financeiras.
 * Exige papel OWNER ou ADMIN.
 */
export async function disconnectMercadoPagoIntegration() {
  const context = await requireWorkspaceRole(["OWNER", "ADMIN"]);

  const existing = await db.integrationAccount.findFirst({
    where: {
      workspaceId: context.workspaceId,
      provider: "MERCADO_PAGO",
      environment: "SANDBOX",
    },
  });

  if (!existing) {
    return { success: false, error: "Nenhuma integração encontrada para desconectar." };
  }

  await db.$transaction(async (tx) => {
    await tx.integrationAccount.update({
      where: { id: existing.id },
      data: {
        encryptedCredentials: null,
        status: "DISCONNECTED",
        lastValidationErrorCode: null,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorType: "USER",
        actorId: context.userId,
        action: "MP_INTEGRATION_DISCONNECTED",
        entityType: "IntegrationAccount",
        entityId: existing.id,
        metadata: {
          environment: "SANDBOX",
        },
      },
    });
  });

  revalidatePath("/configuracoes");

  return { success: true, status: "DISCONNECTED" };
}
