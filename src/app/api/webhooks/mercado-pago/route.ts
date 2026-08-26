import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { decryptCredentials, parseMercadoPagoCredentials } from "@/lib/server/credentials-crypto";
import { getOrderById } from "@/integrations/mercado-pago/orders-client";
import { classifyFixedChargePayment } from "@/domain/pix-receivable";
import { settlePixChargeAtomic } from "@/server/services/pix-settlement-service";

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
  const timestampRaw = Number(ts);
  const timestamp = ts.length >= 13 ? Math.floor(timestampRaw / 1000) : Math.floor(timestampRaw);
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
    const queryDataId = searchParams.get("data.id");
    const dataId = String(queryDataId || "");

    if (!dataId) {
      return NextResponse.json({ error: "ID do recurso não informado" }, { status: 400 });
    }

    // Processar apenas tópicos relacionados a Orders / Merchant Orders
    if (type && !["order", "merchant_order"].includes(type)) {
      return NextResponse.json({ ignored: true, message: `Tópico ${type} ignorado neste marco (apenas Orders).` }, { status: 200 });
    }

    // 1. Validar Assinatura (Exigida obrigatoriamente — sem dev bypass)
    const sigVerification = verifyWebhookSignature(req, dataId.toLowerCase());

    // Regra 30: Determinar ambiente antes de criar registro idempotente
    if (typeof body.live_mode !== "boolean") {
      return NextResponse.json({ error: "live_mode ausente na notificação" }, { status: 400 });
    }
    const isLive = body.live_mode;
    const environment = isLive ? "PRODUCTION" : "SANDBOX";

    // Regra 29: Identificador único baseado na NOTIFICAÇÃO (x-request-id ou ID único de webhook), não na action
    const xRequestId = req.headers.get("x-request-id");
    if (!xRequestId) return NextResponse.json({ error: "x-request-id ausente" }, { status: 400 });
    const eventId = `ev_${xRequestId}`;

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
        data: { status: "RECEIVED", lastErrorCode: "PIX_CHARGE_NOT_FOUND_RETRY" },
      });
      return NextResponse.json({ error: "Cobrança ainda não registrada; aguardando retry do Mercado Pago." }, { status: 500 });
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
      if (!remoteOrder.paidAt || !remoteOrder.paymentId || remoteOrder.externalReference !== pixCharge.externalReference ||
          classifyFixedChargePayment(Number(pixCharge.amountCents), remoteOrder.amountCents || 0) === "DIVERGENT") {
        await db.webhookEvent.update({ where: { id: webhookEvent.id }, data: { status: "FAILED", lastErrorCode: "INCOMPLETE_PAYMENT_EVIDENCE" } });
        return NextResponse.json({ received: true, processed: false, reason: "Evidência oficial incompleta ou divergente" }, { status: 202 });
      }
      const paidAt = new Date(remoteOrder.paidAt);

      // BAIXA ATÔMICA DA PARCELA COM CLAIM EXCLUSIVO VIA SERVIÇO UNIFICADO (Correção L)
      await settlePixChargeAtomic({
        pixChargeId: pixCharge.id,
        installmentId: pixCharge.installmentId,
        workspaceId: pixCharge.workspaceId,
        amountCents: Number(pixCharge.amountCents),
        paidAt,
        actorType: "WEBHOOK",
        actorId: "MERCADO_PAGO_WEBHOOK",
        externalOrderId: dataId,
      });

      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    } else if (!remoteOrder.success) {
      // Correção J: Falha remota transitória NÃO marca PROCESSED — fica retryable
      const isTransient = remoteOrder.errorCode === "TIMEOUT" || remoteOrder.errorCode === "NETWORK_ERROR" ||
        (remoteOrder.errorCode?.startsWith("HTTP_5"));
      if (isTransient) {
        await db.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: { status: "RECEIVED", lastErrorCode: `REMOTE_TRANSIENT:${remoteOrder.errorCode}` },
        });
        // Retornar 500 para induzir retry do Mercado Pago
        return NextResponse.json({ error: "Falha transitória ao consultar Order" }, { status: 500 });
      }
      // Erro permanente (ex: HTTP_404) — marcar como FAILED, não PROCESSED
      await db.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: "FAILED", lastErrorCode: `REMOTE_PERMANENT:${remoteOrder.errorCode}` },
      });
    } else {
      // remoteOrder.success mas não isPaid — status legítimo, pode marcar PROCESSED
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
