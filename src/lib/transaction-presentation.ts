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

  const isExplicitYield = /\b(rendimento|rentabilidade|yield)\b/i.test(evidenceText);
  const isExplicitTax = /\b(imposto|tributo|reten[cç][aã]o|irrf|iof|tax)\b/i.test(evidenceText);

  const rawRef = (raw.EXTERNAL_REFERENCE && String(raw.EXTERNAL_REFERENCE).trim()) || "";
  const fallbackRef = rawRef
    ? `Ref: ${rawRef}`
    : (raw.SOURCE_ID && String(raw.SOURCE_ID).trim()
      ? `ID: ${String(raw.SOURCE_ID).trim()}`
      : "Mercado Pago");

  // 1. Ajuste Manual da Conta Geral
  if (isManual) {
    return {
      title: desc || (direction === "CREDIT" ? "Entrada manual" : "Saída manual"),
      subtitle: "Conta geral manual",
      isKnownCounterpart: false,
      identificationStatus: "OFFICIAL",
    };
  }

  // 2. Transações Pix recebidas
  const isPixReceived = desc.toLowerCase().startsWith("pix recebido") ||
    raw.PAYMENT_METHOD === "pix" ||
    raw.PAYMENT_METHOD_TYPE === "bank_transfer" ||
    (type === "SETTLEMENT" && direction === "CREDIT" && (bank || counterpart));

  if (isPixReceived && direction === "CREDIT") {
    const isBankName = /banco|unibanco|pagamentos|ip\b|financiamento|cooperativa|s\.a\.|caixa|bradesco|santander|inter\b|nubank/i.test(counterpart);
    const isOfficialStatement = accountStatement?.source === "MERCADO_PAGO_ACCOUNT_STATEMENT_CSV";

    if (isBankName) {
      return {
        title: "Pix recebido",
        subtitle: `Origem: ${counterpart}`,
        isKnownCounterpart: true,
        identificationStatus: "OFFICIAL",
      };
    }

    if (counterpart) {
      return {
        title: counterpart,
        subtitle: bank ? `Pix recebido · ${bank}` : "Pix recebido",
        isKnownCounterpart: true,
        identificationStatus: isOfficialStatement ? "OFFICIAL" : "INFERRED",
      };
    }

    return {
      title: "Pix recebido",
      subtitle: bank ? `Origem: ${bank}` : fallbackRef,
      isKnownCounterpart: Boolean(bank),
      identificationStatus: bank ? "OFFICIAL" : "UNIDENTIFIED",
    };
  }

  // 3. Saídas em conta (PAYOUT, PAYOUTS, WITHDRAWAL)
  if (["PAYOUT", "PAYOUTS", "WITHDRAWAL"].includes(type) || ["PAYOUT", "PAYOUTS", "WITHDRAWAL"].includes(desc.toUpperCase())) {
    const isOfficialStatement = accountStatement?.source === "MERCADO_PAGO_ACCOUNT_STATEMENT_CSV";
    const isInferredRule = enrichment?.source === "INFERRED" || enrichment?.counterpartRule;

    // Detectar modalidade exata pelo padrão da referência externa (igual ao app MP)
    let operation = "Transferência Pix enviada";
    if (rawRef.startsWith("QR") || desc.toLowerCase().includes("qr")) {
      operation = "Pagamento com QR Pix";
    } else if (rawRef.startsWith("RESN") || rawRef.startsWith("PIX")) {
      operation = "Transferência Pix enviada";
    } else if (type === "WITHDRAWAL" || bank) {
      operation = bank ? `Transferência para ${bank}` : "Transferência bancária";
    } else if (desc.toLowerCase().includes("débito") || desc.toLowerCase().includes("debito")) {
      operation = "Compra no débito";
    } else if (desc.toLowerCase().includes("boleto") || desc.toLowerCase().includes("conta")) {
      operation = "Pagamento de conta";
    }

    // Se temos a contraparte real (aprendida por regra ou oficial de extrato)
    if (counterpart && (isOfficialStatement || isInferredRule)) {
      return {
        title: counterpart,
        subtitle: operation,
        isKnownCounterpart: true,
        identificationStatus: isOfficialStatement ? "OFFICIAL" : "INFERRED",
      };
    }

    // Se é saída mas ainda não tem nome do favorecido, usamos a operação real bancária, NUNCA jargão técnico
    if (direction === "DEBIT") {
      return {
        title: counterpart || operation,
        subtitle: counterpart ? operation : fallbackRef,
        isKnownCounterpart: Boolean(counterpart),
        identificationStatus: counterpart ? "INFERRED" : "UNIDENTIFIED",
      };
    } else {
      return {
        title: "Devolução de transferência",
        subtitle: counterpart || fallbackRef,
        isKnownCounterpart: Boolean(counterpart),
        identificationStatus: counterpart ? "INFERRED" : "UNIDENTIFIED",
      };
    }
  }

  // 4. Rendimentos do saldo e Impostos retidos
  const amountCentsNum = Number(tx.amountCents || 0);
  const isCentsAmount = amountCentsNum > 0 && amountCentsNum < 100;
  const isLikelyYield = direction === "CREDIT" && (isExplicitYield || (type === "SETTLEMENT" && !counterpart && isCentsAmount));
  const isLikelyTax = direction === "DEBIT" && (isExplicitTax || (type === "SETTLEMENT" && !counterpart && isCentsAmount));

  if (isLikelyYield) {
    return {
      title: "Rendimento do saldo",
      subtitle: "Mercado Pago (CDI)",
      isKnownCounterpart: true,
      identificationStatus: "OFFICIAL",
    };
  }

  if (isLikelyTax) {
    return {
      title: "Imposto sobre rendimento",
      subtitle: "Retenção oficial Mercado Pago",
      isKnownCounterpart: true,
      identificationStatus: "OFFICIAL",
    };
  }

  // 5. Liquidações comuns (SETTLEMENT) com descrição nominal do provedor
  if (type === "SETTLEMENT" || desc === "SETTLEMENT") {
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
        title: counterpart || "Entrada de recursos",
        subtitle: counterpart ? "Recebimento aprovado" : fallbackRef,
        isKnownCounterpart: Boolean(counterpart),
        identificationStatus: counterpart ? "OFFICIAL" : "UNIDENTIFIED",
      };
    } else {
      return {
        title: counterpart || "Pagamento efetuado",
        subtitle: counterpart ? "Débito em conta" : fallbackRef,
        isKnownCounterpart: Boolean(counterpart),
        identificationStatus: counterpart ? "OFFICIAL" : "UNIDENTIFIED",
      };
    }
  }

  // 6. Estornos e Reembolsos
  if (type === "REFUND" || desc === "REFUND") {
    return {
      title: direction === "CREDIT" ? "Estorno recebido" : "Devolução de Pix",
      subtitle: counterpart || fallbackRef,
      isKnownCounterpart: Boolean(counterpart),
      identificationStatus: "OFFICIAL",
    };
  }

  // 7. Contestações e Disputas
  if (type === "DISPUTE" || desc === "DISPUTE") {
    return {
      title: "Contestação de pagamento",
      subtitle: counterpart || fallbackRef,
      isKnownCounterpart: Boolean(counterpart),
      identificationStatus: "OFFICIAL",
    };
  }

  // 8. Transações com descrição nominal rica
  if (desc) {
    return {
      title: desc,
      subtitle: counterpart || fallbackRef,
      isKnownCounterpart: Boolean(counterpart),
      identificationStatus: counterpart ? "OFFICIAL" : "INFERRED",
    };
  }

  // 9. Fallback amigável
  return {
    title: direction === "CREDIT" ? "Entrada de recursos" : "Pagamento efetuado",
    subtitle: counterpart || fallbackRef,
    isKnownCounterpart: Boolean(counterpart),
    identificationStatus: counterpart ? "INFERRED" : "UNIDENTIFIED",
  };
}
