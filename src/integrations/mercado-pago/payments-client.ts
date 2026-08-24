import { centsToDecimalString } from "./orders-client";

if (typeof window !== "undefined") {
  throw new Error("SERVER_ONLY_ERROR: O cliente da Payments API só pode ser executado no servidor.");
}

export interface RefundPaymentInput {
  accessToken: string;
  paymentId: string;
  amountCents?: number; // Optional, se vazio devolve tudo
  idempotencyKey: string;
}

export interface RefundPaymentResult {
  success: boolean;
  refundId?: string;
  status?: string;
  amountCents?: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Reembolsa um pagamento Pix no Mercado Pago via POST https://api.mercadopago.com/v1/payments/{payment_id}/refunds
 */
export async function refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
  const { accessToken, paymentId, amountCents, idempotencyKey } = input;

  if (!accessToken || !accessToken.trim()) {
    return { success: false, errorCode: "MISSING_TOKEN", errorMessage: "Access Token não informado." };
  }

  if (!paymentId) {
    return { success: false, errorCode: "MISSING_PAYMENT_ID", errorMessage: "ID do Pagamento não informado." };
  }

  if (!idempotencyKey || !idempotencyKey.trim()) {
    return { success: false, errorCode: "MISSING_IDEMPOTENCY_KEY", errorMessage: "Chave de idempotência necessária." };
  }

  const payload: any = {};
  if (amountCents) {
    payload.amount = parseFloat(centsToDecimalString(amountCents));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey.trim(),
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (response.status === 201 || response.status === 200) {
      return {
        success: true,
        refundId: String(data.id),
        status: data.status, // geralmente "approved"
        amountCents: data.amount ? Math.round(data.amount * 100) : amountCents,
      };
    }

    // Tratamento de erros
    const errorMessage = data.message || data.error || `Erro HTTP ${response.status} na API de Refunds`;
    return {
      success: false,
      errorCode: `HTTP_${response.status}`,
      errorMessage,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      return { success: false, errorCode: "TIMEOUT", errorMessage: "Tempo limite excedido ao estornar pagamento." };
    }
    return { success: false, errorCode: "NETWORK_ERROR", errorMessage: "Falha de conectividade com a API de Pagamentos." };
  }
}
