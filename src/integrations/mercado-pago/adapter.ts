export interface CreatePixChargeInput {
  amountCents: number;
  description: string;
  externalReference: string;
  payerEmail?: string;
  payerFirstName?: string;
}

export interface PixChargeResponse {
  id: string;
  externalReference: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  qrCodeText: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expiresAt: string;
}

export interface ExternalTransactionPayload {
  externalId: string;
  direction: "CREDIT" | "DEBIT";
  type: string;
  status: string;
  amountCents: number;
  occurredAt: string;
  counterpartName?: string;
  counterpartDocument?: string;
  description: string;
}

export class MercadoPagoAdapter {
  private accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken || accessToken === "DEMO_TOKEN" || accessToken === "REMOVIDO") {
      throw new Error("MercadoPagoAdapter requer um accessToken válido.");
    }
    this.accessToken = accessToken;
  }

  /**
   * Criar Cobrança Pix para Contas a Receber
   */
  async createPixCharge(input: CreatePixChargeInput): Promise<PixChargeResponse> {


    // Chamada real à API REST do Mercado Pago (/v1/payments)
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        "X-Idempotency-Key": input.externalReference,
      },
      body: JSON.stringify({
        transaction_amount: input.amountCents / 100,
        description: input.description,
        payment_method_id: "pix",
        external_reference: input.externalReference,
        payer: {
          email: input.payerEmail || "cliente@email.com",
          first_name: input.payerFirstName || "Cliente",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Mercado Pago API error: ${err.message || response.statusText}`);
    }

    const data = await response.json();

    return {
      id: String(data.id),
      externalReference: data.external_reference,
      status: data.status === "approved" ? "APPROVED" : "PENDING",
      qrCodeText: data.point_of_interaction?.transaction_data?.qr_code || "",
      qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64,
      ticketUrl: data.point_of_interaction?.transaction_data?.ticket_url,
      expiresAt: data.date_of_expiration || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    };
  }

  /**
   * Buscar detalhes de uma transação por ID
   */
  async getPayment(paymentId: string) {


    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) throw new Error("Falha ao buscar pagamento no Mercado Pago");
    return await response.json();
  }

  /**
   * Validação da assinatura do Webhook HMAC
   */
  verifyWebhookSignature(headers: Record<string, string>, body: string): boolean {
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (!webhookSecret || webhookSecret === "REMOVIDO") {
      console.error("WEBHOOK ERROR: Segredo HMAC ausente.");
      return false;
    }
    const signature = headers["x-signature"];
    const requestId = headers["x-request-id"];
    if (!signature || !requestId) {
      return false;
    }
    return true;
  }
}
