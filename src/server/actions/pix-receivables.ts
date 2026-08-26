"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { decryptCredentials, parseMercadoPagoCredentials } from "@/lib/server/credentials-crypto";
import { createPixOrder, getOrderById } from "@/integrations/mercado-pago/orders-client";
import { assertReceivableDirection, classifyFixedChargePayment, getFixedChargeAmount, getPixChargeIdempotencyKey } from "@/domain/pix-receivable";
import { settlePixChargeAtomic } from "@/server/services/pix-settlement-service";

const generateChargeSchema = z.object({
  installmentId: z.string().min(1),
});

export interface PixChargeStatusResult {
  success: boolean;
  pixChargeId?: string;
  externalOrderId?: string;
  status: string; // CREATING, PENDING, PAID, EXPIRED, FAILED
  isPaid: boolean;
  amountCents?: number;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expiresAt?: string;
  paidAt?: string;
  debtorName?: string;
  title?: string;
  error?: string;
  remoteCheckError?: string;
}

import { getActiveMercadoPagoIntegrationForWorkspace } from "@/server/services/mercado-pago-integration";

/**
 * Gera uma Cobrança Pix via Orders API para uma Parcela de Conta a Receber.
 * NUNCA permite geração para Contas a Pagar (PAYABLE).
 */
export async function generateReceivablePixCharge(input: {
  installmentId: string;
}): Promise<PixChargeStatusResult> {
  const context = await requireAuthenticatedWorkspace();

  const parsed = generateChargeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, status: "FAILED", isPaid: false, error: "ID de parcela inválido." };
  }

  const { installmentId } = parsed.data;

  // 1. Carregar a Parcela e o Item Financeiro com verificação de workspace
  const installment = await db.installment.findFirst({
    where: {
      id: installmentId,
      financialItem: {
        workspaceId: context.workspaceId,
        deletedAt: null,
      },
    },
    include: {
      financialItem: {
        include: {
          contact: true,
        },
      },
      pixCharges: {
        where: {
          status: { in: ["CREATING", "PENDING", "ACTION_REQUIRED", "FAILED"] },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!installment) {
    return {
      success: false,
      status: "FAILED",
      isPaid: false,
      error: "Parcela não encontrada ou não pertence a este workspace.",
    };
  }

  // 2. REGRA DE SEGURANÇA EXPLICITA: Apenas Contas a Receber (RECEIVABLE)
  try {
    assertReceivableDirection(installment.financialItem.direction);
  } catch (error: any) {
    return {
      success: false,
      status: "FAILED",
      isPaid: false,
      error: error.message,
    };
  }

  // 3. Verificar Saldo Pendente
  const totalCents = Number(installment.amountCents);
  const settledCents = Number(installment.settledAmountCents);
  const remainingCents = totalCents - settledCents;

  if (remainingCents <= 0 || installment.status === "SETTLED") {
    return { success: false, status: "PAID", isPaid: true, error: "Esta parcela já está totalmente quitada." };
  }

  const chargeAmountCents = getFixedChargeAmount(totalCents, settledCents);

  if (chargeAmountCents <= 0) {
    return { success: false, status: "FAILED", isPaid: false, error: "O valor da cobrança deve ser maior que zero." };
  }

  // 4. Verificar e-mail REAL do devedor/contato (Regra 22: Sem email fake de devedor ou do proprietário)
  const debtorEmail = installment.financialItem.contact?.email?.trim();
  if (!debtorEmail) {
    return {
      success: false,
      status: "FAILED",
      isPaid: false,
      error: "O devedor/contato precisa ter um e-mail válido cadastrado no perfil de contatos para emitir cobrança Pix.",
    };
  }

  // 5. Verificar integração ativa com Mercado Pago (Regra 23: Resolver dinâmico da integração ativa)
  let integration;
  try {
    integration = await getActiveMercadoPagoIntegrationForWorkspace(context.workspaceId);
  } catch (e: any) {
    return {
      success: false,
      status: "FAILED",
      isPaid: false,
      error: e.message || "Integração do Mercado Pago não configurada ou inativa no Workspace.",
    };
  }

  // 6. Verificar se já existe uma cobrança PENDING válida reutilizável
  const existingPending = installment.pixCharges.find(
    (c) => (c.status === "PENDING" || c.status === "ACTION_REQUIRED") && c.qrCode && c.expiresAt && c.expiresAt > new Date()
  );
  if (existingPending) {
    return {
      success: true,
      pixChargeId: existingPending.id,
      externalOrderId: existingPending.externalOrderId ?? undefined,
      status: existingPending.status,
      isPaid: existingPending.status === "PAID",
      amountCents: Number(existingPending.amountCents),
      qrCode: existingPending.qrCode ?? undefined,
      ticketUrl: existingPending.ticketUrl ?? undefined,
      expiresAt: existingPending.expiresAt ? existingPending.expiresAt.toISOString() : undefined,
      debtorName: installment.financialItem.contact?.name || "Devedor",
      title: installment.financialItem.title,
    };
  }

  const existingCreating = installment.pixCharges.find((c) => c.status === "CREATING");

  // 7. Descriptografar Access Token
  let accessToken: string;
  try {
    const creds = parseMercadoPagoCredentials(integration.encryptedCredentials!);
    accessToken = creds.accessToken;
  } catch (e) {
    return { success: false, status: "FAILED", isPaid: false, error: "Erro ao descriptografar credencial do workspace." };
  }

  // 8. Chave de Idempotência e Referência (Reutilizar se CREATING, ou Nova Chave para FAILED/EXPIRED)
  const attemptTag = Date.now();
  const idempotencyKey = existingCreating
    ? existingCreating.idempotencyKey
    : `pix_${context.workspaceId}_${installment.id}_${chargeAmountCents}_${attemptTag}`;
  const externalReference = existingCreating
    ? existingCreating.externalReference
    : `NVX-REC-${installment.id.slice(0, 8)}-${idempotencyKey.slice(-12)}`;

  // 9. Criar Registro Local no Banco (Status CREATING com proteção contra concorrência)
  let pixCharge = existingCreating;
  if (!pixCharge) {
    try {
      pixCharge = await db.pixCharge.create({
        data: {
          workspaceId: context.workspaceId,
          integrationAccountId: integration.id,
          financialItemId: installment.financialItemId,
          installmentId: installment.id,
          provider: "MERCADO_PAGO",
          environment: integration.environment,
          externalReference,
          idempotencyKey,
          amountCents: BigInt(chargeAmountCents),
          currency: "BRL",
          status: "CREATING",
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        const found = await db.pixCharge.findFirst({
          where: { installmentId: installment.id },
          orderBy: { createdAt: "desc" },
        });
        if (found) pixCharge = found;
      }
      if (!pixCharge) {
        return { success: false, status: "FAILED", isPaid: false, error: "Falha na criação concorrente da cobrança Pix." };
      }
    }
  }

  // 10. Chamar Mercado Pago Orders API
  const orderResult = await createPixOrder({
    accessToken,
    amountCents: chargeAmountCents,
    externalReference,
    idempotencyKey,
    payerEmail: debtorEmail,
    description: `Cobrança NOVEX: ${installment.financialItem.title} (Parc. ${installment.sequence})`,
    expirationMinutes: 30,
  });

  if (!orderResult.success || !orderResult.orderId) {
    await db.pixCharge.update({
      where: { id: pixCharge.id },
      data: {
        status: "FAILED",
        statusDetail: orderResult.errorMessage || "Falha ao criar Order no Mercado Pago.",
      },
    });

    return {
      success: false,
      status: "FAILED",
      isPaid: false,
      error: orderResult.errorMessage || "Não foi possível criar a Order de cobrança Pix no Mercado Pago.",
    };
  }

  // 11. Atualizar PixCharge com os dados reais retornados
  const updatedCharge = await db.pixCharge.update({
    where: { id: pixCharge.id },
    data: {
      externalOrderId: orderResult.orderId,
      status: "PENDING",
      qrCode: orderResult.qrCode || null,
      ticketUrl: orderResult.ticketUrl || null,
      expiresAt: orderResult.expiresAt ? new Date(orderResult.expiresAt) : null,
    },
  });

  // 12. Registrar Auditoria
  await db.auditLog.create({
    data: {
      workspaceId: context.workspaceId,
      actorType: "USER",
      actorId: context.userId,
      action: "MP_PIX_CHARGE_CREATED",
      entityType: "PixCharge",
      entityId: updatedCharge.id,
      metadata: {
        installmentId: installment.id,
        externalOrderId: orderResult.orderId,
        amountCents: chargeAmountCents,
        environment: integration.environment,
      },
    },
  });

  revalidatePath("/contas-a-receber");

  return {
    success: true,
    pixChargeId: updatedCharge.id,
    externalOrderId: updatedCharge.externalOrderId || undefined,
    status: "PENDING",
    isPaid: false,
    amountCents: chargeAmountCents,
    qrCode: updatedCharge.qrCode || undefined,
    ticketUrl: updatedCharge.ticketUrl || undefined,
    expiresAt: updatedCharge.expiresAt?.toISOString(),
    debtorName: installment.financialItem.contact?.name || "Devedor",
    title: installment.financialItem.title,
  };
}

/**
 * Consulta o status atualizado da Cobrança Pix e realiza a Baixa Atômica se quitado.
 */
export async function getReceivablePixChargeStatus(input: { pixChargeId: string }): Promise<PixChargeStatusResult> {
  const context = await requireAuthenticatedWorkspace();

  const pixCharge = await db.pixCharge.findFirst({
    where: {
      id: input.pixChargeId,
      workspaceId: context.workspaceId,
    },
    include: {
      installment: {
        include: {
          financialItem: {
            include: { contact: true },
          },
        },
      },
      integrationAccount: true,
    },
  });

  if (!pixCharge) {
    return { success: false, status: "FAILED", isPaid: false, error: "Cobrança Pix não encontrada." };
  }

  // Se já estiver paga localmente, retornar sucesso imediato
  if (pixCharge.status === "PAID") {
    return {
      success: true,
      pixChargeId: pixCharge.id,
      externalOrderId: pixCharge.externalOrderId || undefined,
      status: "PAID",
      isPaid: true,
      amountCents: Number(pixCharge.amountCents),
      paidAt: pixCharge.paidAt?.toISOString(),
      debtorName: pixCharge.installment.financialItem.contact?.name || "Devedor",
      title: pixCharge.installment.financialItem.title,
    };
  }

  // Se possuir OrderId e Access Token, consultar na API remota
  if (pixCharge.externalOrderId && pixCharge.integrationAccount?.encryptedCredentials) {
    let accessToken: string;
    try {
      const creds = parseMercadoPagoCredentials(pixCharge.integrationAccount.encryptedCredentials);
      accessToken = creds.accessToken;
      const remoteOrder = await getOrderById({ accessToken, orderId: pixCharge.externalOrderId });
      if (!remoteOrder.success) {
        return { success: false, status: pixCharge.status, isPaid: false, pixChargeId: pixCharge.id, remoteCheckError: remoteOrder.errorMessage || "Falha ao consultar Order." };
      }

      if (remoteOrder.success && remoteOrder.isPaid) {
        if (!remoteOrder.paymentId || remoteOrder.externalReference !== pixCharge.externalReference ||
            classifyFixedChargePayment(Number(pixCharge.amountCents), remoteOrder.paidAmountCents || remoteOrder.amountCents || 0) === "DIVERGENT") {
          return { success: false, status: "INCOMPLETE", isPaid: false, error: "Order processada sem evidências oficiais completas ou com valor/referência divergente." };
        }
        // LIQUIDAÇÃO ATÔMICA DA PARCELA VIA CLAIM UNIFICADO (Correção L — polling)
        const paidAt = remoteOrder.providerUpdatedAt ? new Date(remoteOrder.providerUpdatedAt) : new Date();

        await settlePixChargeAtomic({
          pixChargeId: pixCharge.id,
          paidAt,
          actorType: "USER",
          actorId: context.userId,
          externalOrderId: pixCharge.externalOrderId || undefined,
          paidAmountCents: remoteOrder.paidAmountCents,
        });

        revalidatePath("/contas-a-receber");
        revalidatePath("/");

        return {
          success: true,
          pixChargeId: pixCharge.id,
          externalOrderId: pixCharge.externalOrderId,
          status: "PAID",
          isPaid: true,
          amountCents: Number(pixCharge.amountCents),
          paidAt: paidAt.toISOString(),
          debtorName: pixCharge.installment.financialItem.contact?.name || "Devedor",
          title: pixCharge.installment.financialItem.title,
        };
      }
    } catch (e) {
      console.error("Erro ao consultar status da Order:", e);
      return { success: false, status: pixCharge.status, isPaid: false, pixChargeId: pixCharge.id, error: "Falha de comunicação ao consultar status remoto." };
    }
  }

  return {
    success: true,
    pixChargeId: pixCharge.id,
    externalOrderId: pixCharge.externalOrderId || undefined,
    status: pixCharge.status,
    isPaid: false,
    amountCents: Number(pixCharge.amountCents),
    qrCode: pixCharge.qrCode || undefined,
    ticketUrl: pixCharge.ticketUrl || undefined,
    expiresAt: pixCharge.expiresAt?.toISOString(),
    debtorName: pixCharge.installment.financialItem.contact?.name || "Devedor",
    title: pixCharge.installment.financialItem.title,
  };
}

/**
 * Busca cobrança Pix ativa existente para uma parcela.
 */
export async function getActivePixChargeForInstallment(input: { installmentId: string }) {
  const context = await requireAuthenticatedWorkspace();

  const charge = await db.pixCharge.findFirst({
    where: {
      installmentId: input.installmentId,
      workspaceId: context.workspaceId,
      status: { in: ["PENDING", "PAID"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!charge) return null;

  return {
    id: charge.id,
    externalOrderId: charge.externalOrderId,
    status: charge.status,
    amountCents: Number(charge.amountCents),
    qrCode: charge.qrCode,
    ticketUrl: charge.ticketUrl,
    expiresAt: charge.expiresAt?.toISOString(),
  };
}
