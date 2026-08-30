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
import { getActiveMercadoPagoIntegrationForWorkspace } from "@/server/services/mercado-pago-integration";
import { evolutionAPIClient } from "@/integrations/evolution-api/client";

const saveCredentialsSchema = z.object({
  accessToken: z.string().min(10).max(512),
  publicKey: z.string().optional(),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
});

export interface IntegrationStatusResult {
  isConnected: boolean;
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";
  environment: string;
  maskedToken?: string;
  publicKey?: string;
  lastValidatedAt?: string;
  lastValidationErrorCode?: string;
  externalAccountId?: string;
  canManage: boolean;
}

/**
 * Resolver único server-only para obter a integração ativa do Mercado Pago
 */
export async function getActiveMercadoPagoIntegration() {
  const context = await requireAuthenticatedWorkspace();
  const account = await getActiveMercadoPagoIntegrationForWorkspace(context.workspaceId);
  return {
    id: account.id, provider: account.provider, status: account.status, environment: account.environment,
    displayName: account.displayName, lastSyncAt: account.lastSyncAt, lastValidatedAt: account.lastValidatedAt,
    lastValidationErrorCode: account.lastValidationErrorCode,
  };
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
      status: { in: ["CONNECTED", "CONNECTING", "ERROR"] }, isActive: true,
    },
  });

  if (!integration || !integration.encryptedCredentials || integration.status === "DISCONNECTED") {
    return {
      isConnected: false,
      status: "DISCONNECTED",
      environment: "NAO_DETECTADO",
      canManage: isAdmin,
    };
  }

  let maskedToken: string | undefined = undefined;
  let publicKey: string | undefined = undefined;

  if (isAdmin && integration.encryptedCredentials) {
    try {
      const rawData = decryptCredentials(integration.encryptedCredentials);
      if (rawData.startsWith("{")) {
        const parsed = JSON.parse(rawData);
        maskedToken = maskAccessToken(parsed.accessToken || "");
        publicKey = parsed.publicKey;
      } else {
        maskedToken = maskAccessToken(rawData);
      }
    } catch (e) {
      maskedToken = "••••••••••••";
    }
  }

  return {
    isConnected: integration.status === "CONNECTED",
    status: (integration.status as any) || "DISCONNECTED",
    environment: integration.environment,
    maskedToken,
    publicKey,
    lastValidatedAt: integration.lastValidatedAt?.toISOString(),
    lastValidationErrorCode: integration.lastValidationErrorCode || undefined,
    externalAccountId: integration.externalAccountId || undefined,
    canManage: isAdmin,
  };
}

/**
 * Salva ou substitui credenciais do Mercado Pago (Public Key e Access Token) de forma atômica.
 * Exige papel OWNER ou ADMIN.
 */
export async function saveMercadoPagoCredentials(input: {
  accessToken: string;
  publicKey?: string;
  environment?: "SANDBOX" | "PRODUCTION";
}) {
  try {
    const context = await requireWorkspaceRole(["OWNER", "ADMIN"]);

    const parsed = saveCredentialsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Formato de token ou parâmetros inválidos." };
    }

    const { accessToken, publicKey } = parsed.data;

    // 1. Determinar ambiente: respeitar valor explícito ou sinal confiável
    const detectedEnvironment = input.environment || (accessToken.startsWith("TEST-") ? "SANDBOX" : "PRODUCTION");

    // 1. Validação local do formato
    const localCheck = validateTokenLocalFormat(accessToken);
    if (!localCheck.valid) {
      return { success: false, error: localCheck.reason || "Formato de Access Token inválido." };
    }

    // 2. Validação remota com AbortController em https://api.mercadolibre.com/users/me
    const validation = await validateAccessToken(accessToken);

    if (!validation.valid) {
      try {
        await db.auditLog.create({
          data: {
            workspaceId: context.workspaceId,
            actorType: "USER",
            actorId: context.userId,
            action: "MP_CONNECTION_FAILED",
            entityType: "IntegrationAccount",
            entityId: `MERCADO_PAGO_${detectedEnvironment}`,
            metadata: {
              errorCode: validation.errorCode,
              environment: detectedEnvironment,
            },
          },
        });
      } catch (e) {}

      return {
        success: false,
        error: validation.errorMessage || "Não foi possível validar o Access Token junto ao Mercado Pago.",
        errorCode: validation.errorCode,
      };
    }

    // 3. Criptografia dos dados com AES-256-GCM
    const credentialsPayload = JSON.stringify({ accessToken, publicKey: publicKey?.trim() || "" });
    const encryptedCredentials = encryptCredentials(credentialsPayload);
    const masked = maskAccessToken(accessToken);

    // 4. Salvar de forma atômica no banco de dados
    const result = await db.$transaction(async (tx) => {
      const financialAccount = await tx.financialAccount.upsert({
        where: { workspaceId_type: { workspaceId: context.workspaceId, type: "MERCADO_PAGO" } },
        update: { isActive: true },
        create: { workspaceId: context.workspaceId, type: "MERCADO_PAGO", name: "Mercado Pago" },
      });

      // Desativar integrações prévias do mesmo provedor
      await tx.integrationAccount.updateMany({
        where: { workspaceId: context.workspaceId, provider: "MERCADO_PAGO" },
        data: { isActive: false },
      });

      const account = await tx.integrationAccount.upsert({
        where: {
          workspaceId_provider_environment: {
            workspaceId: context.workspaceId,
            provider: "MERCADO_PAGO",
            environment: detectedEnvironment,
          },
        },
        update: {
          encryptedCredentials,
          externalAccountId: validation.externalAccountId || null,
          externalApplicationId: validation.externalApplicationId || null,
          providerAccountCreatedAt: validation.accountCreatedAt ? new Date(validation.accountCreatedAt) : null,
          financialAccountId: financialAccount.id,
          historyBackfillStatus: "NOT_STARTED",
          status: "CONNECTED",
          isActive: true,
          lastValidatedAt: new Date(),
          lastValidationErrorCode: null,
        },
        create: {
          workspaceId: context.workspaceId,
          provider: "MERCADO_PAGO",
          environment: detectedEnvironment,
          displayName: `Mercado Pago ${detectedEnvironment === "PRODUCTION" ? "Produção" : "Sandbox"}`,
          encryptedCredentials,
          externalAccountId: validation.externalAccountId || null,
          externalApplicationId: validation.externalApplicationId || null,
          providerAccountCreatedAt: validation.accountCreatedAt ? new Date(validation.accountCreatedAt) : null,
          financialAccountId: financialAccount.id,
          historyBackfillStatus: "NOT_STARTED",
          status: "CONNECTED",
          isActive: true,
          lastValidatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorType: "USER",
          actorId: context.userId,
          action: "MP_CREDENTIAL_SAVED",
          entityType: "IntegrationAccount",
          entityId: account.id,
          metadata: {
            environment: detectedEnvironment,
            externalAccountId: validation.externalAccountId,
            maskedToken: masked,
            hasPublicKey: !!publicKey,
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
      environment: detectedEnvironment,
      lastValidatedAt: result.lastValidatedAt?.toISOString(),
    };
  } catch (error: any) {
    console.error("Erro ao salvar no banco local PostgreSQL:", error.message);
    return {
      success: false,
      error: "Credenciais validadas no Mercado Pago, mas ocorreu um erro ao salvar no banco de dados local.",
    };
  }
}

/**
 * Valida novamente a conexão atual salva no banco.
 */
export async function validateMercadoPagoConnection() {
  const context = await requireWorkspaceRole(["OWNER", "ADMIN"]);

  const integration = await db.integrationAccount.findFirst({
    where: {
      workspaceId: context.workspaceId,
      provider: "MERCADO_PAGO",
      status: { in: ["CONNECTED", "ERROR"] }, isActive: true,
    },
  });

  if (!integration || !integration.encryptedCredentials) {
    return { success: false, error: "Nenhuma credencial configurada no workspace." };
  }

  let token: string;
  try {
    const rawData = decryptCredentials(integration.encryptedCredentials);
    if (rawData.startsWith("{")) {
      token = JSON.parse(rawData).accessToken;
    } else {
      token = rawData;
    }
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
      providerAccountCreatedAt: validation.valid && validation.accountCreatedAt ? new Date(validation.accountCreatedAt) : integration.providerAccountCreatedAt,
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
 */
export async function disconnectMercadoPagoIntegration() {
  const context = await requireWorkspaceRole(["OWNER", "ADMIN"]);

  const existing = await db.integrationAccount.findFirst({
    where: {
      workspaceId: context.workspaceId,
      provider: "MERCADO_PAGO",
      status: { in: ["CONNECTED", "ERROR", "CONNECTING"] }, isActive: true,
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
        isActive: false,
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
          environment: existing.environment,
        },
      },
    });
  });

  revalidatePath("/configuracoes");

  return { success: true, status: "DISCONNECTED" };
}

/**
 * Retorna o status da integração Evolution API (DTO Sanitizado - NUNCA expõe apiKey ao React)
 */
export async function getEvolutionApiStatus() {
  const context = await requireAuthenticatedWorkspace();

  const integration = await db.integrationAccount.findFirst({
    where: {
      workspaceId: context.workspaceId,
      provider: "EVOLUTION_API",
    },
  });

  if (!integration || !integration.encryptedCredentials) {
    const envKey = process.env.EVOLUTION_API_KEY || "";
    return {
      isConnected: false,
      baseUrl: process.env.EVOLUTION_PUBLIC_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:8081" : ""),
      instanceName: process.env.EVOLUTION_INSTANCE_NAME || "novex-finance",
      maskedApiKey: envKey ? `${envKey.slice(0, 3)}•••••${envKey.slice(-3)}` : "",
      managedLocally: true,
    };
  }

  let baseUrl = "";
  let maskedApiKey = "";
  let instanceName = "";

  try {
    const rawData = decryptCredentials(integration.encryptedCredentials);
    const parsed = JSON.parse(rawData);
    baseUrl = parsed.baseUrl || "";
    instanceName = parsed.instanceName || "";
    if (parsed.apiKey) {
      maskedApiKey = parsed.apiKey.length > 6
        ? `${parsed.apiKey.slice(0, 3)}•••••${parsed.apiKey.slice(-3)}`
        : "••••••••";
    }
  } catch (e) {
    // ignorar erro de parse
  }

  return {
    isConnected: integration.status === "CONNECTED",
    baseUrl,
    instanceName,
    maskedApiKey,
    managedLocally: baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") || baseUrl.includes("evolution"),
  };
}

/**
 * Salva as configurações da Evolution API no banco para o Workspace
 */
export async function saveEvolutionApiCredentials(input: {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}) {
  try {
    const context = await requireWorkspaceRole(["OWNER", "ADMIN"]);
    let parsedBaseUrl: URL;
    try { parsedBaseUrl = new URL(input.baseUrl.trim()); } catch { return { success: false, error: "Base URL inválida." }; }
    const isLocal = ["localhost", "127.0.0.1", "evolution", "evoapicloud"].includes(parsedBaseUrl.hostname);
    if (parsedBaseUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsedBaseUrl.protocol === "http:") && !isLocal) {
      return { success: false, error: "Base URL deve usar HTTPS em produção." };
    }
    if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) return { success: false, error: "Esquema de URL não permitido." };

    if (/[•*]{3,}/.test(input.apiKey)) {
      return { success: false, error: "A máscara da API key não pode ser salva como credencial." };
    }
    const existing = await db.integrationAccount.findUnique({
      where: { workspaceId_provider_environment: { workspaceId: context.workspaceId, provider: "EVOLUTION_API", environment: "PRODUCTION" } },
    });
    let apiKey = input.apiKey.trim();
    if (!apiKey && existing?.encryptedCredentials) {
      const previous = JSON.parse(decryptCredentials(existing.encryptedCredentials));
      apiKey = String(previous.apiKey || "").trim();
    }
    if (!apiKey) return { success: false, error: "API key da Evolution é obrigatória." };

    const credentialsPayload = JSON.stringify({
      baseUrl: parsedBaseUrl.toString().replace(/\/$/, ""),
      apiKey,
      instanceName: input.instanceName.trim(),
    });

    const encryptedCredentials = encryptCredentials(credentialsPayload);
    const remoteState = await evolutionAPIClient.checkConnectionState(
      parsedBaseUrl.toString().replace(/\/$/, ""), apiKey, input.instanceName.trim()
    );

    await db.$transaction(async (tx) => {
      const account = await tx.integrationAccount.upsert({
        where: {
          workspaceId_provider_environment: {
            workspaceId: context.workspaceId,
            provider: "EVOLUTION_API",
            environment: "PRODUCTION",
          },
        },
        update: {
          encryptedCredentials,
          status: remoteState.success && remoteState.state === "open" ? "CONNECTED" : "CONNECTING",
          isActive: true,
          lastValidatedAt: new Date(),
        },
        create: {
          workspaceId: context.workspaceId,
          provider: "EVOLUTION_API",
          environment: "PRODUCTION",
          displayName: "Evolution API WhatsApp",
          encryptedCredentials,
          status: remoteState.success && remoteState.state === "open" ? "CONNECTED" : "CONNECTING",
          isActive: true,
          lastValidatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorType: "USER",
          actorId: context.userId,
          action: "EVOLUTION_API_CREDENTIALS_SAVED",
          entityType: "IntegrationAccount",
          entityId: account.id,
        },
      });
    });

    revalidatePath("/configuracoes");

    return { success: true, status: remoteState.state, warning: remoteState.success ? undefined : remoteState.error };
  } catch (error: any) {
    console.error("Erro ao salvar Evolution API credentials:", error);
    return { success: false, error: error.message || "Erro interno ao salvar." };
  }
}
