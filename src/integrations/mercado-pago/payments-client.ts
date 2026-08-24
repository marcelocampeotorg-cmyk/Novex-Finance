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
  return {
    success: false,
    errorCode: "FORBIDDEN_OPERATION",
    errorMessage: "REGRA_DE_SEGURANCA_ABS: O NOVEX V1 nunca executa saída de dinheiro, refund ou estorno pela API.",
  };
}
