import type { MercadoPagoRawTransaction } from "./reports-client";

export interface MercadoPagoPaymentEnrichment {
  description?: string;
  counterpartName?: string;
  counterpartDocument?: string;
  txid?: string;
  rawReference?: string;
  rawEnrichmentData?: Record<string, any>;
}

export class MercadoPagoPaymentsClient {
  private accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken || accessToken === "DEMO_TOKEN" || accessToken === "REMOVIDO") {
      throw new Error("MercadoPagoPaymentsClient requer um accessToken válido.");
    }
    this.accessToken = accessToken;
  }

  /**
   * Mapeia um objeto de pagamento retornado pela API do Mercado Pago exclusivamente para enriquecimento descritivo.
   * Não possui autoridade financeira: NÃO define direction, amountCents, netAmountCents ou occurredAt.
   */
  mapPaymentToEnrichmentData(p: any): MercadoPagoPaymentEnrichment {
    const bankPayer = p.point_of_interaction?.transaction_data?.bank_info?.payer?.long_name;
    const bankCollector = p.point_of_interaction?.transaction_data?.bank_info?.collector?.long_name;
    const personName = p.payer?.first_name ? `${p.payer.first_name} ${p.payer.last_name || ""}`.trim() : "";
    const counterpartName = bankPayer || personName || (bankCollector && !bankCollector.includes("MERCADO PAGO") ? bankCollector : undefined) || undefined;
    const counterpartDocument = p.payer?.identification?.number || undefined;

    let description = p.description;
    if (!description || description.trim() === "") {
      if (p.payment_method_id === "pix" || p.payment_method?.id === "pix") {
        description = counterpartName ? `Pix Recebido - ${counterpartName}` : "Pix Recebido";
      } else if (p.operation_type === "account_fund") {
        description = counterpartName ? `Entrada Pix - ${counterpartName}` : "Entrada de Recursos";
      } else if (counterpartName) {
        description = `Pagamento - ${counterpartName}`;
      } else {
        description = p.operation_type ? p.operation_type.replace(/_/g, " ").toUpperCase() : undefined;
      }
    }

    const txid = p.point_of_interaction?.transaction_data?.transaction_id || p.point_of_interaction?.transaction_data?.e2e_id || undefined;
    const rawReference = p.external_reference || undefined;

    return {
      description,
      counterpartName,
      counterpartDocument,
      txid,
      rawReference,
      rawEnrichmentData: {
        id: p.id,
        status: p.status,
        status_detail: p.status_detail,
        payment_method_id: p.payment_method_id,
        payment_type_id: p.payment_type_id,
        operation_type: p.operation_type,
        payer: p.payer,
        point_of_interaction: p.point_of_interaction,
        fee_details: p.fee_details,
      },
    };
  }

  /**
   * Converte um pagamento aprovado da Payments API em MercadoPagoRawTransaction
   * compatível com a chave composta de deduplicação do Settlement Report.
   */
  mapPaymentToRawTransaction(p: any): MercadoPagoRawTransaction | null {
    if (!p || !p.id) return null;
    const isApproved = p.status === "approved" && ["accredited", "approved"].includes(String(p.status_detail || "").toLowerCase());
    if (!isApproved) return null;

    const netReceived = p.transaction_details?.net_received_amount ?? p.transaction_amount ?? 0;
    const totalAmount = p.transaction_amount ?? netReceived;
    const netAmountCents = Math.round(Number(netReceived) * 100);
    const amountCents = Math.round(Number(totalAmount) * 100);
    const feeCents = Math.max(0, amountCents - netAmountCents);

    const enrichment = this.mapPaymentToEnrichmentData(p);
    const rawSourceId = String(p.id);
    const typeStr = "SETTLEMENT";
    const direction = "CREDIT";
    const compositeExternalId = `${rawSourceId}_${typeStr}_${direction}_${netAmountCents}`;

    const occurredAt = new Date(p.date_approved || p.date_created || Date.now()).toISOString();

    return {
      externalId: compositeExternalId,
      occurredAt,
      type: typeStr,
      description: enrichment.description || "Pix Recebido",
      direction,
      amountCents,
      feeCents,
      netAmountCents,
      counterpartName: enrichment.counterpartName,
      counterpartDocument: enrichment.counterpartDocument,
      txid: enrichment.txid,
      rawReference: enrichment.rawReference,
      rawProviderData: {
        payment_id: String(p.id),
        operation_type: String(p.operation_type || ""),
        payment_method_id: String(p.payment_method_id || ""),
        status: String(p.status || ""),
        status_detail: String(p.status_detail || ""),
        source: "MERCADO_PAGO_REALTIME_PAYMENT",
      },
    };
  }

  /**
   * Busca pagamentos recentes aprovados na Payments API
   */
  async searchRecentApprovedPayments(options: { beginDate?: Date; limit?: number } = {}): Promise<MercadoPagoRawTransaction[]> {
    try {
      const limit = Math.min(options.limit || 50, 50);
      const url = new URL("https://api.mercadopago.com/v1/payments/search");
      url.searchParams.set("sort", "date_created");
      url.searchParams.set("criteria", "desc");
      url.searchParams.set("limit", String(limit));

      if (options.beginDate) {
        url.searchParams.set("range", "date_created");
        url.searchParams.set("begin_date", options.beginDate.toISOString().replace(/\.\d{3}Z$/, "Z"));
        url.searchParams.set("end_date", new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": "NovexFinance/1.0 (Realtime Payment Integration)",
        },
      });

      if (!response.ok) {
        console.warn(`[MercadoPagoPaymentsClient] Falha ao buscar pagamentos recentes: HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results : [];

      const transactions: MercadoPagoRawTransaction[] = [];
      for (const p of results) {
        const raw = this.mapPaymentToRawTransaction(p);
        if (raw) transactions.push(raw);
      }

      return transactions;
    } catch (err) {
      console.error("[MercadoPagoPaymentsClient] Erro na busca de pagamentos recentes:", err);
      return [];
    }
  }

  /**
   * Obtém os detalhes de um pagamento específico por ID para enriquecimento de fato financeiro já existente
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

