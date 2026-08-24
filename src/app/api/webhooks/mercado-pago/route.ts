import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { decryptCredentials, parseMercadoPagoCredentials } from "@/lib/server/credentials-crypto";
import { getOrderById } from "@/integrations/mercado-pago/orders-client";

/**
 * Valida a assinatura HMAC-SHA256 do cabeçalho x-signature oficial da Orders API.
 */
/**
 * Valida a assinatura HMAC-SHA256 do cabeçalho x-signature oficial da Orders API.
 */
function verifyWebhookSignature(req: NextRequest, dataId: string): { valid: boolean; reason?: string } {
  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id") || "";
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  if (!secret || secret === "REMOVIDO") {
    return { valid: false, reason: "MERCADO_PAGO_WEBHOOK_SECRET ausente." };
  }

  if (!xSignature) {
    return { valid: false, reason: "Cabeçalho x-signature ausente." };
  }

  // Extrair ts e v1 do x-signature (ex: "ts=1700000000,v1=abcdef...")
  const parts = xSignature.split(",");
  let ts = "";
  let hashV1 = "";

  for (const part of parts) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if (key === "ts") ts = value;
    if (key === "v1") hashV1 = value;
  }

  if (!ts || !hashV1) {
    return { valid: false, reason: "Formato do cabeçalho x-signature inválido." };
  }

  // Validação de tolerância do timestamp (máximo 5 minutos)
  const timestamp = parseInt(ts, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(timestamp) || Math.abs(now - timestamp) > 300) {
    return { valid: false, reason: "Timestamp da assinatura fora da tolerância de 5 minutos." };
  }

  // Montar manifesto oficial do tópico Order: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const computedHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const valid = crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hashV1));
    return { valid };
  } catch (e) {
    return { valid: false, reason: "Falha na verificação criptográfica da assinatura HMAC." };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);

    // Identificar tipo de recurso (Tópico "order" obrigatório)
    const type = body.type || body.topic || searchParams.get("type") || searchParams.get("topic");
    const dataId = String(body.data?.id || body.id || searchParams.get("data.id") || searchParams.get("id") || "");

    if (!dataId) {
      return NextResponse.json({ error: "ID do recurso não informado" }, { status: 400 });
    }

    // Processar apenas tópicos relacionados a Orders / Merchant Orders
    if (type && !["order", "merchant_order"].includes(type)) {
      return NextResponse.json({ ignored: true, message: `Tópico ${type} ignorado neste marco (apenas Orders).` }, { status: 200 });
    }

    // 1. Validar Assinatura (Exigida obrigatoriamente — sem dev bypass)
    const sigVerification = verifyWebhookSignature(req, dataId);

    // Regra 30: Determinar ambiente antes de criar registro idempotente
    const isLive = body.live_mode === true || body.action === "order.paid";
    const environment = isLive ? "PRODUCTION" : "SANDBOX";

    // Regra 29: Identificador único baseado na NOTIFICAÇÃO (x-request-id ou ID único de webhook), não na action
    const xRequestId = req.headers.get("x-request-id");
    const eventId = xRequestId ? `ev_${xRequestId}` : `ev_ord_${dataId}_${Date.now()}`;

    // 2. Inbox Idempotente de Webhook
    const existingEvent = await db.webhookEvent.findUnique({
      where: {
        provider_environment_eventId: {
          provider: "MERCADO_PAGO",
          environment,
          eventId,
        },
      },
    });

    if (existingEvent && existingEvent.status === "PROCESSED") {
      return NextResponse.json({ received: true, idempotent: true }, { status: 200 });
    }

    // Gravar evento no Inbox
    const webhookEvent = await db.webhookEvent.upsert({
      where: {
        provider_environment_eventId: {
          provider: "MERCADO_PAGO",
          environment,
          eventId,
        },
      },
      update: {
        attempts: { increment: 1 },
        signatureValid: sigVerification.valid,
      },
      create: {
        provider: "MERCADO_PAGO",
        environment,
        eventId,
        resourceType: type || "order",
        resourceId: dataId,
        action: body.action || "updated",
        signatureValid: sigVerification.valid,
        status: "RECEIVED",
      },
    });

    if (!sigVerification.valid) {
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "FAILED", lastErrorCode: "INVALID_SIGNATURE" },
      });
      return NextResponse.json({ error: sigVerification.reason || "Assinatura inválida" }, { status: 401 });
    }

    // 3. Localizar PixCharge correspondente ao externalOrderId
    const pixCharge = await db.pixCharge.findFirst({
      where: {
        externalOrderId: dataId,
        provider: "MERCADO_PAGO",
      },
      include: {
        integrationAccount: true,
        installment: true,
      },
    });

    if (!pixCharge) {
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "PROCESSED", lastErrorCode: "PIX_CHARGE_NOT_FOUND" },
      });
      return NextResponse.json({ received: true, note: "Order não pertence a cobrança ativa do NOVEX." }, { status: 200 });
    }

    if (pixCharge.status === "PAID") {
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "PROCESSED" },
      });
      return NextResponse.json({ received: true, alreadyPaid: true }, { status: 200 });
    }

    // 4. Fonte de Verdade: Consultar Order oficialmente via GET /v1/orders/{dataId}
    if (!pixCharge.integrationAccount?.encryptedCredentials) {
      return NextResponse.json({ error: "Credencial da integração não encontrada." }, { status: 500 });
    }

    const creds = parseMercadoPagoCredentials(pixCharge.integrationAccount.encryptedCredentials);
    const remoteOrder = await getOrderById({ accessToken: creds.accessToken, orderId: dataId });

    if (remoteOrder.success && remoteOrder.isPaid) {
      const paidAt = remoteOrder.paidAt ? new Date(remoteOrder.paidAt) : new Date();

      // BAIXA ATÔMICA DA PARCELA
      await db.$transaction(async (tx) => {
        const currentCharge = await tx.pixCharge.findUnique({ where: { id: pixCharge.id } });
        const currentInstallment = await tx.installment.findUnique({ where: { id: pixCharge.installmentId } });

        if (!currentCharge || currentCharge.status === "PAID" || !currentInstallment || currentInstallment.status === "SETTLED") {
          return;
        }

        await tx.pixCharge.update({
          where: { id: pixCharge.id },
          data: {
            status: "PAID",
            paidAt,
            lastCheckedAt: new Date(),
          },
        });

        const currentSettled = Number(currentInstallment.settledAmountCents);
        const chargeAmount = Number(currentCharge.amountCents);
        const totalAmount = Number(currentInstallment.amountCents);
        const newSettled = currentSettled + chargeAmount;
        const newStatus = newSettled >= totalAmount ? "SETTLED" : "PARTIAL";

        await tx.installment.update({
          where: { id: pixCharge.installmentId },
          data: {
            settledAmountCents: BigInt(newSettled),
            status: newStatus,
            settlementDate: paidAt,
          },
        });

        // Regra 31: Notificação Webhook dá baixa na parcela e vincula o LedgerEntry existente ou cria provisório com sourceId único
        const existingLedger = await tx.ledgerEntry.findFirst({
          where: { workspaceId: pixCharge.workspaceId, sourceType: "MERCADO_PAGO_PIX", sourceId: dataId },
        });

        if (!existingLedger) {
          await tx.ledgerEntry.create({
            data: {
              workspaceId: pixCharge.workspaceId,
              installmentId: pixCharge.installmentId,
              direction: "CREDIT",
              amountCents: BigInt(chargeAmount),
              occurredAt: paidAt,
              sourceType: "MERCADO_PAGO_PIX",
              sourceId: dataId,
            },
          });
        }

        await tx.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: "PROCESSED",
            processedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId: pixCharge.workspaceId,
            actorType: "SYSTEM",
            actorId: "MERCADO_PAGO_WEBHOOK",
            action: "MP_PIX_WEBHOOK_SETTLED",
            entityType: "PixCharge",
            entityId: pixCharge.id,
            metadata: {
              orderId: dataId,
              amountCents: chargeAmount,
              installmentId: pixCharge.installmentId,
            },
          },
        });
      });
    } else {
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "PROCESSED" },
      });
    }

    return NextResponse.json({ received: true, status: remoteOrder.status || "PROCESSED" }, { status: 200 });
  } catch (error: any) {
    console.error("Erro no processamento do webhook do Mercado Pago:", error);
    return NextResponse.json({ error: "Erro interno no servidor ao processar webhook" }, { status: 500 });
  }
}
