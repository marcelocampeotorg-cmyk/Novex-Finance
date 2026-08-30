import type { MercadoPagoRawTransaction } from "./reports-client";

export class MercadoPagoPaymentsClient {
  private accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken || accessToken === "DEMO_TOKEN" || accessToken === "REMOVIDO") {
      throw new Error("MercadoPagoPaymentsClient requer um accessToken válido.");
    }
    this.accessToken = accessToken;
  }

  /**
   * Mapeia um objeto de pagamento retornado pela API do Mercado Pago para a estrutura normalizada MercadoPagoRawTransaction.
   */
  mapPaymentToRawTransaction(p: any, userId?: string | number): MercadoPagoRawTransaction {
    const rawId = String(p.id);
    const occurredAt = p.date_approved || p.date_created || p.money_release_date || new Date().toISOString();
    const type = p.operation_type || p.payment_type_id || "PAYMENT";

    const bankPayer = p.point_of_interaction?.transaction_data?.bank_info?.payer?.long_name;
    const bankCollector = p.point_of_interaction?.transaction_data?.bank_info?.collector?.long_name;
    const personName = p.payer?.first_name ? `${p.payer.first_name} ${p.payer.last_name || ""}`.trim() : "";
    const counterpartName = bankPayer || personName || (bankCollector && !bankCollector.includes("MERCADO PAGO") ? bankCollector : undefined) || p.description || undefined;

    // Determinação precisa da direção (CREDIT vs DEBIT)
    let direction: "CREDIT" | "DEBIT" = "CREDIT";
    if (p.operation_type === "recurring_payment") {
      direction = "DEBIT";
    } else if (p.payer?.id && userId && String(p.payer.id) === String(userId) && p.operation_type !== "account_fund") {
      direction = "DEBIT";
    } else if (p.transaction_details?.net_received_amount !== undefined && p.transaction_details.net_received_amount < 0) {
      direction = "DEBIT";
    } else {
      direction = "CREDIT";
    }

    const amount = Math.abs(Number(p.transaction_amount || 0));
    const netReceived = p.transaction_details?.net_received_amount !== undefined
      ? Math.abs(Number(p.transaction_details.net_received_amount))
      : amount;
    const feeAmount = p.fee_details?.reduce((acc: number, f: any) => acc + Number(f.amount || 0), 0) || Math.max(0, amount - netReceived);

    const amountCents = Math.round(amount * 100);
    const feeCents = Math.round(feeAmount * 100);
    const netAmountCents = Math.round(netReceived * 100);

    let description = p.description;
    if (!description || description.trim() === "") {
      if (p.payment_method_id === "pix" || p.payment_method?.id === "pix") {
        description = counterpartName ? `Pix Recebido - ${counterpartName}` : "Pix Recebido";
      } else if (p.operation_type === "account_fund") {
        description = counterpartName ? `Entrada Pix - ${counterpartName}` : "Entrada de Recursos";
      } else if (counterpartName) {
        description = `Pagamento - ${counterpartName}`;
      } else {
        description = p.operation_type ? p.operation_type.replace(/_/g, " ").toUpperCase() : "Pagamento Mercado Pago";
      }
    }

    const txid = p.point_of_interaction?.transaction_data?.transaction_id || p.point_of_interaction?.transaction_data?.e2e_id || undefined;
    const rawReference = p.external_reference || undefined;

    return {
      externalId: rawId,
      occurredAt,
      type,
      description,
      direction,
      amountCents,
      feeCents,
      netAmountCents,
      counterpartName,
      txid,
      rawReference,
      rawProviderData: {
        ...p,
        SOURCE_ID: rawId,
        DESCRIPTION: description,
        PAYMENT_METHOD: p.payment_method_id || p.payment_method?.id || "",
        COUNTERPART_NAME: counterpartName || "",
      },
    };
  }

  /**
   * Consulta os pagamentos mais recentes em tempo real via /v1/payments/search
   */
  async searchLivePayments(options: { limit?: number; beginDate?: Date; endDate?: Date; userId?: string | number } = {}): Promise<MercadoPagoRawTransaction[]> {
    const limit = options.limit || 50;
    const params = new URLSearchParams({
      sort: "date_created",
      criteria: "desc",
      limit: String(limit),
    });

    if (options.beginDate) {
      params.set("begin_date", options.beginDate.toISOString());
    }
    if (options.endDate) {
      params.set("end_date", options.endDate.toISOString());
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/search?${params}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "NovexFinance/1.0 (Financial Management Integration)",
      },
    });

    if (response.status === 429) {
      console.warn("[MercadoPagoPaymentsClient] Rate limit atingido (HTTP 429). Aguardando próximo ciclo de sincronização.");
      return [];
    }

    if (!response.ok) {
      console.warn(`[MercadoPagoPaymentsClient] /v1/payments/search retornou HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];

    return results
      .filter((p: any) => p.status === "approved" || p.status === "accredited")
      .map((p: any) => this.mapPaymentToRawTransaction(p, options.userId));
  }

  /**
   * Obtém os detalhes de um pagamento específico por ID para enriquecimento
   */
  async getPaymentDetails(paymentId: string | number): Promise<any | null> {
    try {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "NovexFinance/1.0 (Financial Management Integration)",
        },
      });

      if (response.status === 429) {
        console.warn(`[MercadoPagoPaymentsClient] Rate limit atingido em /v1/payments/${paymentId}`);
        return null;
      }

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }
}
