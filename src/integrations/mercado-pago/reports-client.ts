export interface MercadoPagoReportFile {
  id: string;
  fileName: string;
  createdDate: string;
  totalAmountCents: number;
  transactionCount: number;
  downloadUrl?: string;
  status: "READY" | "PROCESSING" | "FAILED";
}

export interface MercadoPagoRawTransaction {
  externalId: string;
  occurredAt: string;
  type: string;
  description: string;
  direction: "CREDIT" | "DEBIT";
  amountCents: number;
  feeCents: number;
  netAmountCents: number;
  counterpartName?: string;
  counterpartDocument?: string;
  txid?: string;
  rawReference?: string;
}

export class MercadoPagoReportsClient {
  private accessToken: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN || "DEMO_TOKEN";
  }

  /**
   * Buscar extrato de movimentações externas (Relatório Dinheiro em Conta)
   */
  async fetchAccountStatement(startDate?: Date, endDate?: Date): Promise<MercadoPagoRawTransaction[]> {
    const isDemo = this.accessToken === "DEMO_TOKEN" || this.accessToken === "REMOVIDO" || !this.accessToken;

    if (isDemo) {
      // Movimentações demonstrativas de teste/desenvolvimento
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000);

      return [
        {
          externalId: `MP-TX-REC-${Date.now()}-1`,
          occurredAt: now.toISOString(),
          type: "PIX_RECEIVED",
          description: "Recebimento Pix QR Code - Cliente Exemplo",
          direction: "CREDIT",
          amountCents: 150000,
          feeCents: 148,
          netAmountCents: 149852,
          counterpartName: "Mariana Souza Santos",
          counterpartDocument: "123.456.789-00",
          txid: "NOVEX-PIX-2026-001",
          rawReference: "MP-ORDER-9982",
        },
        {
          externalId: `MP-TX-PAY-${Date.now()}-2`,
          occurredAt: yesterday.toISOString(),
          type: "CARD_PURCHASE",
          description: "Posto Shell - Combustível Frota",
          direction: "DEBIT",
          amountCents: 24500,
          feeCents: 0,
          netAmountCents: 24500,
          counterpartName: "Posto Shell Ltda",
          counterpartDocument: "12.345.678/0001-90",
          rawReference: "DEBIT_CARD_AUTH_882",
        },
        {
          externalId: `MP-TX-PAY-${Date.now()}-3`,
          occurredAt: twoDaysAgo.toISOString(),
          type: "PIX_SENT",
          description: "Pagamento de Fornecedor - Tech Solutions",
          direction: "DEBIT",
          amountCents: 85000,
          feeCents: 0,
          netAmountCents: 85000,
          counterpartName: "Tech Solutions Inovacao Ltda",
          counterpartDocument: "98.765.432/0001-10",
          txid: "PAY-SUPPLIER-8812",
          rawReference: "PIX_OUT_99182",
        },
      ];
    }

    try {
      // Chamada à API real do Mercado Pago (/v1/account/settlement_report/list ou /v1/payments/search)
      const beginDate = (startDate || new Date(Date.now() - 30 * 24 * 3600 * 1000)).toISOString();
      const finalDate = (endDate || new Date()).toISOString();

      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&begin_date=${encodeURIComponent(
          beginDate
        )}&end_date=${encodeURIComponent(finalDate)}&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Mercado Pago Reports API error: ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || [];

      return results.map((item: any): MercadoPagoRawTransaction => {
        const isCredit = item.collector_id && item.operation_type !== "money_transfer_out";
        const amountCents = Math.round((item.transaction_amount || 0) * 100);
        const feeCents = Math.round((item.fee_details?.[0]?.amount || 0) * 100);
        const netAmountCents = amountCents - feeCents;

        return {
          externalId: String(item.id),
          occurredAt: item.date_created || item.date_approved || new Date().toISOString(),
          type: item.payment_method_id || item.operation_type || "GENERIC",
          description: item.description || `Transação ${item.id}`,
          direction: isCredit ? "CREDIT" : "DEBIT",
          amountCents,
          feeCents,
          netAmountCents: netAmountCents > 0 ? netAmountCents : amountCents,
          counterpartName: item.payer?.first_name ? `${item.payer.first_name} ${item.payer.last_name || ""}`.trim() : undefined,
          counterpartDocument: item.payer?.identification?.number || undefined,
          txid: item.point_of_interaction?.transaction_data?.transaction_id || undefined,
          rawReference: item.external_reference || undefined,
        };
      });
    } catch (err: any) {
      console.error("Erro ao buscar extrato no Mercado Pago:", err);
      throw err;
    }
  }
}
