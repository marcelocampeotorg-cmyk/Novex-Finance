/**
 * Utilitário determinístico de apresentação humanizada de transações.
 * Converte códigos técnicos de provedores (ex: SETTLEMENT, PAYOUTS) em
 * descrições legíveis e bancárias sem alterar a integridade auditável do banco.
 */

export interface TransactionPresentationInput {
  description?: string | null;
  type?: string | null;
  direction: "CREDIT" | "DEBIT" | string;
  amountCents?: number | bigint | string | null;
  counterpartName?: string | null;
  rawProviderData?: any;
  source?: string | null;
}

export interface TransactionPresentationOutput {
  title: string;
  subtitle: string;
  isKnownCounterpart: boolean;
}

export function formatTransactionDisplay(tx: TransactionPresentationInput): TransactionPresentationOutput {
  const raw = typeof tx.rawProviderData === "string"
    ? (() => { try { return JSON.parse(tx.rawProviderData); } catch { return {}; } })()
    : (tx.rawProviderData || {});

  const bank = typeof raw.POI_BANK_NAME === "string" ? raw.POI_BANK_NAME.trim() : "";

  const counterpart = (
    tx.counterpartName ||
    bank ||
    raw.ISSUER_NAME ||
    raw.POI_WALLET_NAME ||
    ""
  ).trim();

  const desc = (tx.description || "").trim();
  const type = (tx.type || raw.TRANSACTION_TYPE || "").trim().toUpperCase();
  const direction = tx.direction === "CREDIT" ? "CREDIT" : "DEBIT";
  const isManual = tx.source === "MANUAL_ADJUSTMENT";
  const evidenceText = [
    desc,
    raw.DESCRIPTION,
    raw.SALE_DETAIL,
    raw.METADATA,
    raw.OPERATION_TAGS,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  const isYield = /\b(rendimento|rentabilidade|yield)\b/i.test(evidenceText);
  const isTax = /\b(imposto|tributo|reten[cç][aã]o|irrf|iof|tax)\b/i.test(evidenceText);

  // 1. Ajuste Manual da Conta Geral
  if (isManual) {
    return {
      title: desc || (direction === "CREDIT" ? "Entrada manual" : "Saída manual"),
      subtitle: "Conta geral manual",
      isKnownCounterpart: false,
    };
  }

  // 2. Saídas já realizadas fora do NOVEX. O tipo não prova que foi Pix.
  if (["PAYOUT", "PAYOUTS", "WITHDRAWAL"].includes(type) || ["PAYOUT", "PAYOUTS", "WITHDRAWAL"].includes(desc.toUpperCase())) {
    if (direction === "DEBIT") {
      return {
        title: "Transferência ou retirada registrada",
        subtitle: counterpart || "Não informado pelo provedor",
        isKnownCounterpart: Boolean(counterpart),
      };
    } else {
      return {
        title: "Crédito de transferência ou retirada cancelada",
        subtitle: counterpart || "Não informado pelo provedor",
        isKnownCounterpart: Boolean(counterpart),
      };
    }
  }

  // 3. Liquidações e Movimentos em Conta (SETTLEMENT)
  if (type === "SETTLEMENT" || desc === "SETTLEMENT") {
    if (direction === "CREDIT" && isYield) {
      return {
        title: "Rendimento da conta Mercado Pago",
        subtitle: counterpart || "Identificado no relatório oficial",
        isKnownCounterpart: false,
      };
    }
    if (direction === "DEBIT" && isTax) {
      return {
        title: "Imposto / Retenção sobre rendimento",
        subtitle: counterpart || "Identificado no relatório oficial",
        isKnownCounterpart: false,
      };
    }

    // Se o provedor ou enriquecimento já possui uma descrição real (ex.: "Google One", "YouTubePremium")
    if (desc && desc !== "SETTLEMENT") {
      return {
        title: desc,
        subtitle: counterpart || "Mercado Pago",
        isKnownCounterpart: Boolean(counterpart),
      };
    }

    if (direction === "CREDIT") {
      return {
        title: counterpart ? `Entrada - ${counterpart}` : "Entrada na conta Mercado Pago",
        subtitle: counterpart || "Não informado pelo provedor",
        isKnownCounterpart: Boolean(counterpart),
      };
    } else {
      return {
        title: counterpart ? `Saída - ${counterpart}` : "Saída da conta Mercado Pago",
        subtitle: counterpart || "Não informado pelo provedor",
        isKnownCounterpart: Boolean(counterpart),
      };
    }
  }

  // 4. Estornos e Reembolsos
  if (type === "REFUND" || desc === "REFUND") {
    return {
      title: direction === "CREDIT" ? "Estorno recebido" : "Estorno ou devolução registrada",
      subtitle: counterpart || "Não informado pelo provedor",
      isKnownCounterpart: Boolean(counterpart),
    };
  }

  // 5. Contestações e Disputas
  if (type === "DISPUTE" || desc === "DISPUTE") {
    return {
      title: "Contestação de pagamento",
      subtitle: counterpart || "Não informado pelo provedor",
      isKnownCounterpart: Boolean(counterpart),
    };
  }

  // 6. Transações com descrição nominal rica (ex: "Pix Recebido - NU PAGAMENTOS", "Assinatura NOVEX")
  if (desc) {
    return {
      title: desc,
      subtitle: counterpart || "Não informado pelo provedor",
      isKnownCounterpart: Boolean(counterpart),
    };
  }

  // 7. Fallback genérico seguro
  return {
    title: direction === "CREDIT" ? "Entrada Mercado Pago" : "Saída Mercado Pago",
    subtitle: counterpart || "Não informado pelo provedor",
    isKnownCounterpart: Boolean(counterpart),
  };
}
