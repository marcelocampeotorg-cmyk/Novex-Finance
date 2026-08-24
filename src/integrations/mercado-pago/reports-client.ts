export interface MercadoPagoReportFile {
  id: string;
  fileName: string;
  createdDate: string | null;
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
  rawProviderData?: Record<string, string>;
}

export interface ParseCsvResult {
  transactions: MercadoPagoRawTransaction[];
  validCount: number;
  rejectedCount: number;
  errors: string[];
}

/**
 * Parser RFC 4180 para arquivos CSV com suporte a aspas, delimitadores escapados, BOM e quebras de linha.
 */
export function parseCsvRows(csvText: string): { rows: string[][]; delimiter: string } {
  if (!csvText) return { rows: [], delimiter: ";" };

  // Remover UTF-8 BOM se presente
  let cleanText = csvText.replace(/^\uFEFF/, "");

  // Detectar delimitador baseado no cabeçalho
  const firstLineEnd = cleanText.search(/[\r\n]/);
  const headerLine = firstLineEnd >= 0 ? cleanText.slice(0, firstLineEnd) : cleanText;
  const countSemicolons = (headerLine.match(/;/g) || []).length;
  const countCommas = (headerLine.match(/,/g) || []).length;
  const delimiter = countSemicolons >= countCommas ? ";" : ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // pular aspas escapada
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return { rows, delimiter };
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
   * Solicita a geração assíncrona do Relatório Dinheiro em Conta (Settlement Report)
   * POST https://api.mercadopago.com/v1/account/settlement_report
   */
  async requestSettlementReport(
    beginDate?: Date,
    endDate?: Date
  ): Promise<{ success: boolean; reportId?: string; fileFileName?: string; status?: string; error?: string }> {
    try {
      const begin = (beginDate || new Date(Date.now() - 30 * 24 * 3600 * 1000)).toISOString();
      const end = (endDate || new Date()).toISOString();

      const response = await fetch("https://api.mercadopago.com/v1/account/settlement_report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          begin_date: begin,
          end_date: end,
        }),
      });

      if (response.status === 202 || response.ok) {
        const data = await response.json();
        const reportId = data.id !== undefined && data.id !== null ? String(data.id) : undefined;
        const fileFileName = data.file_name || undefined;

        return {
          success: true,
          reportId,
          fileFileName,
          status: data.status || "PROCESSING",
        };
      }

      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errData.message || errData.error || `HTTP ${response.status} ao solicitar settlement_report`,
      };
    } catch (err: any) {
      console.error("Erro ao solicitar settlement_report:", err);
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Busca relatórios Dinheiro em Conta gerados via endpoint oficial /search
   * GET https://api.mercadopago.com/v1/account/settlement_report/search
   */
  async searchSettlementReports(): Promise<MercadoPagoReportFile[]> {
    const response = await fetch("https://api.mercadopago.com/v1/account/settlement_report/search", {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Falha HTTP ${response.status} ao consultar relatórios de liquidação em /settlement_report/search`);
    }

    const data = await response.json();
    const files = Array.isArray(data) ? data : data.results || [];

    return files.map((f: any) => ({
      id: String(f.id || f.file_name || ""),
      fileName: f.file_name || String(f.id || ""),
      createdDate: f.created_date || null,
      totalAmountCents: f.total_amount !== undefined ? Math.round(Number(f.total_amount) * 100) : 0,
      transactionCount: f.transaction_count || 0,
      downloadUrl: f.download_url || undefined,
      status: ["processed", "ready", "created"].includes(String(f.status || "").toLowerCase()) ? "READY" :
        String(f.status || "").toLowerCase() === "failed" ? "FAILED" : "PROCESSING",
    }));
  }

  /**
   * Baixa o arquivo do relatório de liquidação pelo file_name oficial
   * GET https://api.mercadopago.com/v1/account/settlement_report/{file_name}
   */
  async downloadSettlementReport(fileName: string): Promise<string> {
    if (!fileName || !fileName.trim()) {
      throw new Error("downloadSettlementReport requer um fileName válido.");
    }

    const url = `https://api.mercadopago.com/v1/account/settlement_report/${encodeURIComponent(fileName)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao baixar arquivo de liquidação (${fileName})`);
    }

    return await response.text();
  }

  /**
   * Parser oficial robusto do Relatório Dinheiro em Conta (Settlement Report CSV)
   * Realiza validação monetária estrita, correspondência normalizada de colunas e diagnóstico de linhas rejeitadas.
   */
  parseSettlementReportCsv(csvText: string): ParseCsvResult {
    if (!csvText || !csvText.trim()) {
      return { transactions: [], validCount: 0, rejectedCount: 0, errors: ["Arquivo CSV vazio ou nulo."] };
    }

    const { rows } = parseCsvRows(csvText);
    if (rows.length === 0) {
      return { transactions: [], validCount: 0, rejectedCount: 0, errors: ["Arquivo CSV sem linhas processáveis."] };
    }

    const headers = rows[0].map((h) => h.toUpperCase());

    // Mapeamento normalizado de colunas oficiais
    const findExactHeaderIndex = (aliases: string[]) => {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const sourceIdIdx = findExactHeaderIndex(["SOURCE_ID", "EXTERNAL_ID"]);
    const typeIdx = findExactHeaderIndex(["TRANSACTION_TYPE", "TYPE"]);
    const netAmountIdx = findExactHeaderIndex(["SETTLEMENT_NET_AMOUNT", "NET_AMOUNT"]);
    const amountIdx = findExactHeaderIndex(["TRANSACTION_AMOUNT", "AMOUNT"]);
    const feeIdx = findExactHeaderIndex(["FEE_AMOUNT", "FEE"]);
    const dateIdx = findExactHeaderIndex(["SETTLEMENT_DATE", "TRANSACTION_DATE"]);
    const descIdx = findExactHeaderIndex(["DESCRIPTION"]);
    const refIdx = findExactHeaderIndex(["EXTERNAL_REFERENCE"]);

    if (sourceIdIdx === -1 || typeIdx === -1 || dateIdx === -1 || netAmountIdx === -1) {
      return {
        transactions: [],
        validCount: 0,
        rejectedCount: rows.length - 1,
        errors: ["Cabeçalho do CSV não possui as colunas obrigatórias da API oficial Mercado Pago."],
      };
    }

    const transactions: MercadoPagoRawTransaction[] = [];
    const errors: string[] = [];
    let rejectedCount = 0;

    const parseMonetaryValue = (valStr: string | undefined): number | null => {
      if (!valStr || valStr.trim() === "") return 0;
      const cleanStr = valStr.replace(/\s/g, "").replace(",", ".");
      if (!/^-?\d+(\.\d+)?$/.test(cleanStr)) return null;
      const num = parseFloat(cleanStr);
      return isNaN(num) ? null : num;
    };

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const rowLineNum = i + 1;

      const rawSourceId = sourceIdIdx >= 0 ? cols[sourceIdIdx] : undefined;
      if (!rawSourceId || rawSourceId.trim() === "") {
        rejectedCount++;
        errors.push(`Linha ${rowLineNum}: Rejeitada por ausência de SOURCE_ID/EXTERNAL_ID oficial.`);
        continue;
      }

      const rawDateStr = dateIdx >= 0 ? cols[dateIdx] : undefined;
      if (!rawDateStr || rawDateStr.trim() === "") {
        rejectedCount++;
        errors.push(`Linha ${rowLineNum}: Rejeitada por ausência de data de liquidação.`);
        continue;
      }

      const d = new Date(rawDateStr);
      if (isNaN(d.getTime())) {
        rejectedCount++;
        errors.push(`Linha ${rowLineNum}: Rejeitada por data de liquidação inválida (${rawDateStr}).`);
        continue;
      }
      const occurredAt = d.toISOString();

      const rawNetAmountStr = netAmountIdx >= 0 ? cols[netAmountIdx] : undefined;
      const rawAmountStr = amountIdx >= 0 ? cols[amountIdx] : undefined;

      const parsedNetVal = parseMonetaryValue(rawNetAmountStr);
      if (parsedNetVal === null) {
        rejectedCount++;
        errors.push(`Linha ${rowLineNum}: Rejeitada por formato numérico de valor líquido inválido.`);
        continue;
      }

      const parsedAmountVal = parseMonetaryValue(rawAmountStr || rawNetAmountStr);
      const parsedFeeVal = parseMonetaryValue(feeIdx >= 0 ? cols[feeIdx] : "0");

      if (parsedFeeVal === null) {
        rejectedCount++;
        errors.push(`Linha ${rowLineNum}: Rejeitada por formato numérico de tarifa inválido.`);
        continue;
      }

      const netAmountCents = Math.round(parsedNetVal * 100);
      const amountCents = Math.round(Math.abs(parsedAmountVal !== null ? parsedAmountVal : parsedNetVal) * 100);
      const feeCents = Math.round(Math.abs(parsedFeeVal) * 100);

      const direction: "CREDIT" | "DEBIT" = netAmountCents >= 0 ? "CREDIT" : "DEBIT";
      const absNetAmountCents = Math.abs(netAmountCents);

      const typeStr = typeIdx >= 0 ? cols[typeIdx]?.trim() : "";
      if (!typeStr) {
        rejectedCount++;
        errors.push(`Linha ${rowLineNum}: Rejeitada por ausência de TRANSACTION_TYPE oficial.`);
        continue;
      }
      const descStr = descIdx >= 0 && cols[descIdx] ? cols[descIdx] : typeStr;
      const refStr = refIdx >= 0 && cols[refIdx] ? cols[refIdx] : undefined;

      transactions.push({
        externalId: rawSourceId,
        occurredAt,
        type: typeStr,
        description: descStr,
        direction,
        amountCents,
        feeCents,
        netAmountCents: absNetAmountCents,
        rawReference: refStr,
        rawProviderData: Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""])),
      });
    }

    return {
      transactions,
      validCount: transactions.length,
      rejectedCount,
      errors,
    };
  }
}
