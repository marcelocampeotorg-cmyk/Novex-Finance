import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoAdapter } from "@/integrations/mercado-pago/adapter";
import { db } from "@/server/db";
import { settleInstallment } from "@/server/actions/financial-items";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const headersList = Object.fromEntries(req.headers.entries());

    const adapter = new MercadoPagoAdapter();

    // 1. Validar assinatura do webhook
    const isValid = adapter.verifyWebhookSignature(headersList, JSON.stringify(body));
    if (!isValid) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }

    const eventId = body.id || body.data?.id || `evt-${Date.now()}`;
    const action = body.action || body.type || "payment.updated";

    console.log(`[Webhook Mercado Pago] Evento recebido: ${action} (ID: ${eventId})`);

    // 2. Processar evento de pagamento aprovado
    if (action === "payment.updated" || action === "payment.created" || body.data?.id) {
      const paymentId = String(body.data?.id || body.id);
      
      if (paymentId) {
        // Tentar obter transação e dar baixa se houver referência vinculada
        const paymentDetails = await adapter.getPayment(paymentId);
        
        if (paymentDetails && paymentDetails.status === "approved") {
          const externalRef = paymentDetails.external_reference || paymentDetails.externalReference;
          
          if (externalRef) {
            // Localizar parcela correspondente no banco
            const installment = await db.installment.findFirst({
              where: { uniqueReference: externalRef },
            });

            if (installment && installment.status !== "SETTLED") {
              await settleInstallment(installment.id, Number(installment.amountCents));
              console.log(`[Webhook Mercado Pago] Baixa efetuada com sucesso na parcela ${installment.id}`);
            }
          }
        }
      }
    }

    // Responder HTTP 200 rápido para confirmar recebimento ao Mercado Pago
    return NextResponse.json({ received: true, eventId }, { status: 200 });
  } catch (error: any) {
    console.error("[Webhook Mercado Pago] Erro no processamento:", error);
    // Retornar 200 para evitar retries repetidos de payloads com formato inesperado
    return NextResponse.json({ received: true, error: error.message }, { status: 200 });
  }
}
