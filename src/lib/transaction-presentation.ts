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
  rawEnrichmentData?: any;
  source?: string | null;
}

export interface TransactionPresentationOutput {
  title: string;
  subtitle: string;
  isKnownCounterpart: boolean;
  identificationStatus?: "OFFICIAL" | "INFERRED" | "UNIDENTIFIED";
}

export function formatTransactionDisplay(tx: TransactionPresentationInput): TransactionPresentationOutput {
  const raw = typeof tx.rawProviderData === "string"
    ? (() => { try { return JSON.parse(tx.rawProviderData); } catch { return {}; } })()
    : (tx.rawProviderData || {});

  const bank = typeof raw.POI_BANK_NAME === "string" ? raw.POI_BANK_NAME.trim() : "";
  const enrichment = typeof tx.rawEnrichmentData === "string"
    ? (() => { try { return JSON.parse(tx.rawEnrichmentData); } catch { return {}; } })()
    : (tx.rawEnrichmentData || {});
  const accountStatement = enrichment.accountStatement;

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

  const fallbackRef = (raw.EXTERNAL_REFERENCE && String(raw.EXTERNAL_REFERENCE).trim())
    ? `Ref: ${String(raw.EXTERNAL_REFERENCE).trim()}`
    : (raw.SOURCE_ID && String(raw.SOURCE_ID).trim()
      ? `ID: ${String(raw.SOURCE_ID).trim()}`
      : "Não informado pelo provedor");

  // 1. Ajuste Manual da Conta Geral
  if (isManual) {
    return {
      title: desc || (direction === "CREDIT" ? "Entrada manual" : "Saída manual"),
      subtitle: "Conta geral manual",
      isKnownCounterpart: false,
      identificationStatus: "OFFICIAL",
    };
  }

  // 2. Saídas já realizadas fora do NOVEX. O tipo não prova que foi Pix.
  if (["PAYOUT", "PAYOUTS", "WITHDRAWAL"].includes(type) || ["PAYOUT", "PAYOUTS", "WITHDRAWAL"].includes(desc.toUpperCase())) {
    const isOfficialStatement = accountStatement?.source === "MERCADO_PAGO_ACCOUNT_STATEMENT_CSV";
    const isInferredRule = enrichment?.source === "INFERRED" || enrichment?.counterpartRule;

    if (counterpart && (isOfficialStatement || isInferredRule)) {
      const statementType = String(accountStatement?.transactionType || desc || "");
      let operation = "Movimentação Mercado Pago";
      if (statementType.startsWith("Pagamento com QR Pix")) operation = "Pagamento com Pix";
      else if (statementType.startsWith("Pix recebido")) operation = "Pix recebido";
      else if (statementType.startsWith("Transferência Pix enviada") || statementType.startsWith("Pix enviado")) operation = "Transferência Pix enviada";
      else if (statementType.startsWith("Transferência Pix recebida")) operation = "Transferência Pix recebida";
      else if (statementType.startsWith("Pagamento de conta") || statementType.startsWith("Pagamento de boleto") || statementType.startsWith("Pagamento de contas")) operation = "Pagamento de conta";
      else if (statementType.startsWith("Pagamento com cartão de débito") || statementType.startsWith("Compra no débito")) operation = "Cartão de débito";
      else if (statementType.startsWith("TED enviada")) operation = "TED enviada";
      else if (statementType.startsWith("TED recebida")) operation = "TED recebida";
      else if (direction === "DEBIT") operation = "Transferência ou saída";

      return {
        title: counterpart,
        subtitle: operation,
        isKnownCounterpart: true,
        identificationStatus: isOfficialStatement ? "OFFICIAL" : "INFERRED",
      };
    }
    if (direction === "DEBIT") {
      return {
        title: "Transferência ou retirada registrada",
        subtitle: counterpart || fallbackRef,
        isKnownCounterpart: Boolean(counterpart),
        identificationStatus: counterpart ? "INFERRED" : "UNIDENTIFIED",
      };
    } else {
      return {
        title: "Crédito de transferência ou retirada cancelada",
        subtitle: counterpart || fallbackRef,
        isKnownCounterpart: Boolean(counterpart),
        identificationStatus: counterpart ? "INFERRED" : "UNIDENTIFIED",
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
        identificationStatus: "OFFICIAL",
      };
    }
    if (direction === "DEBIT" && isTax) {
      return {
        title: "Imposto / Retenção sobre rendimento",
        subtitle: counterpart || "Identificado no relatório oficial",
        isKnownCounterpart: false,
        identificationStatus: "OFFICIAL",
      };
    }

    // Se o provedor ou enriquecimento já possui uma descrição real (ex.: "Google One", "YouTubePremium")
    if (desc && desc !== "SETTLEMENT") {
      return {
        title: desc,
        subtitle: counterpart || "Mercado Pago",
        isKnownCounterpart: Boolean(counterpart),
        identificationStatus: counterpart ? "OFFICIAL" : "INFERRED",
      };
    }

    if (direction === "CREDIT") {
      return {
        title: counterpart ? `Entrada - ${counterpart}` : "Entrada na conta Mercado Pago",
        subtitle: counterpart || fallbackRef,
        isKnownCounterpart: Boolean(counterpart),
        identificationStatus: counterpart ? "OFFICIAL" : "UNIDENTIFIED",
      };
    } else {
      return {
        title: counterpart ? `Saída - ${counterpart}` : "Saída da conta Mercado Pago",
        subtitle: counterpart || fallbackRef,
        isKnownCounterpart: Boolean(counterpart),
        identificationStatus: counterpart ? "OFFICIAL" : "UNIDENTIFIED",
      };
    }
  }

  // 4. Estornos e Reembolsos
  if (type === "REFUND" || desc === "REFUND") {
    return {
      title: direction === "CREDIT" ? "Estorno recebido" : "Estorno ou devolução registrada",
      subtitle: counterpart || "Não informado pelo provedor",
      isKnownCounterpart: Boolean(counterpart),
      identificationStatus: "OFFICIAL",
    };
  }

  // 5. Contestações e Disputas
  if (type === "DISPUTE" || desc === "DISPUTE") {
    return {
      title: "Contestação de pagamento",
      subtitle: counterpart || "Não informado pelo provedor",
      isKnownCounterpart: Boolean(counterpart),
      identificationStatus: "OFFICIAL",
    };
  }

  // 6. Transações com descrição nominal rica (ex: "Pix Recebido - NU PAGAMENTOS", "Assinatura NOVEX")
  if (desc) {
    return {
      title: desc,
      subtitle: counterpart || "Não informado pelo provedor",
      isKnownCounterpart: Boolean(counterpart),
      identificationStatus: counterpart ? "OFFICIAL" : "INFERRED",
    };
  }

  // 7. Fallback genérico seguro
  return {
    title: direction === "CREDIT" ? "Entrada Mercado Pago" : "Saída Mercado Pago",
    subtitle: counterpart || "Não informado pelo provedor",
    isKnownCounterpart: Boolean(counterpart),
    identificationStatus: counterpart ? "INFERRED" : "UNIDENTIFIED",
  };
}
