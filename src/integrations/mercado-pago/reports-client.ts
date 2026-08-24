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

  constructor(accessToken: string) {
    if (!accessToken || accessToken === "DEMO_TOKEN" || accessToken === "REMOVIDO") {
      throw new Error("MercadoPagoReportsClient requer um accessToken válido.");
    }
    this.accessToken = accessToken;
  }

  /**
   * Buscar extrato de movimentações externas (Relatório Dinheiro em Conta / Pagamentos)
   */
  async fetchAccountStatement(startDate?: Date, endDate?: Date): Promise<MercadoPagoRawTransaction[]> {

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
        const totalFee = (item.fee_details || []).reduce((acc: number, fee: any) => acc + (fee.amount || 0), 0);
        const feeCents = Math.round(totalFee * 100);
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
