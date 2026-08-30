export interface MercadoPagoReportFile {
  id: string;
  fileName: string;
  createdDate: string | null;
  totalAmountCents: number;
  transactionCount: number;
  status: "READY" | "PROCESSING" | "FAILED";
}

export interface MercadoPagoReportTask {
  taskId: string;
  status: "READY" | "PROCESSING" | "FAILED";
  reportId?: string;
  fileName?: string;
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

  private formatIsoWithoutMs(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  /**
   * Garante que a configuração do relatório de liquidação exista na conta do Mercado Pago.
   * Se a conta nunca tiver configurado o relatório, cria a configuração padrão automaticamente.
   */
  async ensureReportConfig(): Promise<void> {
    const requiredColumns = [
      { key: "SOURCE_ID" },
      { key: "EXTERNAL_REFERENCE" },
      { key: "TRANSACTION_TYPE" },
      { key: "DESCRIPTION" },
      { key: "TRANSACTION_AMOUNT" },
      { key: "TRANSACTION_CURRENCY" },
      { key: "FEE_AMOUNT" },
      { key: "SETTLEMENT_NET_AMOUNT" },
      { key: "SETTLEMENT_CURRENCY" },
      { key: "TRANSACTION_DATE" },
      { key: "SETTLEMENT_DATE" },
      { key: "PAYMENT_METHOD" },
      { key: "PAYMENT_METHOD_TYPE" },
    ];

    const reportConfig = {
      file_name_prefix: "novex-settlement",
      display_timezone: "GMT-03",
      frequency: { type: "daily", value: 1, hour: 0 },
      separator: ";",
      scheduled: false,
      include_withdraw: true,
      columns: requiredColumns,
    };

    const configRes = await fetch("https://api.mercadopago.com/v1/account/settlement_report/config", {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (configRes.ok) {
      const currentConfig = await configRes.json();
      const currentColumns = new Set(
        Array.isArray(currentConfig.columns) ? currentConfig.columns.map((column: any) => String(column?.key || "")) : []
      );
      const missingColumns = requiredColumns.filter((col) => !currentColumns.has(col.key));
      const hasWithdraw = currentConfig.include_withdraw === true;

      if (missingColumns.length === 0 && hasWithdraw) return;

      const updatePayload = {
        ...currentConfig,
        include_withdraw: true,
        columns: requiredColumns,
      };

      const updateRes = await fetch("https://api.mercadopago.com/v1/account/settlement_report/config", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      if (!updateRes.ok) {
        const errorData = await updateRes.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${updateRes.status} ao atualizar configuração do settlement_report`);
      }
      return;
    }

    if (configRes.status !== 404) {
      throw new Error(`HTTP ${configRes.status} ao consultar configuração do settlement_report`);
    }

    const createRes = await fetch("https://api.mercadopago.com/v1/account/settlement_report/config", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reportConfig),
    });

    if (!createRes.ok && createRes.status !== 409) {
      throw new Error(`HTTP ${createRes.status} ao criar configuração do settlement_report`);
    }
  }

  /**
   * Solicita a geração assíncrona do Relatório Dinheiro em Conta (Settlement Report)
   * POST https://api.mercadopago.com/v1/account/settlement_report
   */
  async requestSettlementReport(
    beginDate: Date,
    endDate: Date
  ): Promise<{ success: boolean; taskId?: string; status?: "PROCESSING" | "READY"; fileName?: string; error?: string }> {
    try {
      await this.ensureReportConfig();

      const begin = this.formatIsoWithoutMs(beginDate);
      const end = this.formatIsoWithoutMs(endDate);

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

      if (response.ok) {
        const data = await response.json();
        const taskId = data.id !== undefined && data.id !== null ? String(data.id) : undefined;

        return {
          success: true,
          taskId,
          status: data.status || "PROCESSING",
        };
      }

      const errData = await response.json().catch(() => ({}));
      const errMsg = String(errData.message || errData.error || "");

      // Resiliência: se o Mercado Pago atingiu o limite de relatórios gerados simultâneos (HTTP 400 Max number of reports)
      // SOMENTE reutilizar se o relatório na lista corresponder estritamente às datas solicitadas
      if (response.status === 400 || errMsg.toLowerCase().includes("max number of reports")) {
        try {
          const listRes = await fetch("https://api.mercadopago.com/v1/account/settlement_report/list", {
            headers: { Authorization: `Bearer ${this.accessToken}` },
          });
          if (listRes.ok) {
            const list = await listRes.json();
            const requestedBeginUtc = new Date(begin).getTime();
            const requestedEndUtc = new Date(end).getTime();

            const matchingReport = Array.isArray(list) ? list.find((r: any) => {
              if (r.status !== "processed" || !r.file_name) return false;
              if (!r.begin_date || !r.end_date) return false;
              const repBegin = new Date(r.begin_date).getTime();
              const repEnd = new Date(r.end_date).getTime();
              return Math.abs(repBegin - requestedBeginUtc) <= 2 * 3600 * 1000 &&
                     Math.abs(repEnd - requestedEndUtc) <= 2 * 3600 * 1000;
            }) : null;

            if (matchingReport) {
              return {
                success: true,
                taskId: String(matchingReport.id),
                status: "READY",
                fileName: matchingReport.file_name,
              };
            }
          }
        } catch (recoveryErr) {
          console.warn("[ReportsClient] Falha ao recuperar relatórios existentes:", recoveryErr);
        }
      }

      return {
        success: false,
        error: errMsg || `HTTP ${response.status} ao solicitar settlement_report`,
      };
    } catch (err: any) {
      console.error("Erro ao solicitar settlement_report:", err);
      return { success: false, error: err.message || String(err) };
    }
  }

  async getSettlementReportTask(taskId: string): Promise<MercadoPagoReportTask> {
    if (!taskId.trim()) throw new Error("taskId obrigatório.");
    const response = await fetch(`https://api.mercadopago.com/v1/account/settlement_report/task/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ao consultar task de settlement_report`);
    const data = await response.json();
    const rawStatus = String(data.status || "").toLowerCase();
    const status = ["processed", "available", "ready"].includes(rawStatus) ? "READY" :
      ["failed", "error", "cancelled"].includes(rawStatus) ? "FAILED" : "PROCESSING";
    const csvFile = Array.isArray(data.files) ? data.files.find((file: any) => file?.type === "csv") : undefined;
    return {
      taskId, status,
      reportId: data.report_id != null ? String(data.report_id) : data.id != null ? String(data.id) : undefined,
      fileName: data.file_name || csvFile?.name || undefined,
    };
  }

  /**
   * Busca relatórios Dinheiro em Conta gerados via endpoint oficial /search
   * GET https://api.mercadopago.com/v1/account/settlement_report/search
   */
  async searchSettlementReports(filter: { id?: string; fileName?: string; beginDate?: Date; endDate?: Date }): Promise<MercadoPagoReportFile[]> {
    if (!filter.id && !filter.fileName && !filter.beginDate && !filter.endDate) throw new Error("Filtro exato obrigatório para buscar settlement reports.");
    const params = new URLSearchParams();
    if (filter.id) params.set("id", filter.id);
    if (filter.fileName) params.set("file_name", filter.fileName);
    if (filter.beginDate) params.set("begin_date", filter.beginDate.toISOString());
    if (filter.endDate) params.set("end_date", filter.endDate.toISOString());
    const response = await fetch(`https://api.mercadopago.com/v1/account/settlement_report/search?${params}`, {
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
      status: ["processed", "ready"].includes(String(f.status || "").toLowerCase()) ? "READY" :
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
    const typeIdx = findExactHeaderIndex(["TRANSACTION_TYPE", "RECORD_TYPE", "TYPE"]);
    const netAmountIdx = findExactHeaderIndex(["SETTLEMENT_NET_AMOUNT", "NET_AMOUNT"]);
    const netCreditIdx = findExactHeaderIndex(["NET_CREDIT_AMOUNT"]);
    const netDebitIdx = findExactHeaderIndex(["NET_DEBIT_AMOUNT"]);
    const amountIdx = findExactHeaderIndex(["TRANSACTION_AMOUNT", "GROSS_AMOUNT", "AMOUNT"]);
    const feeIdx = findExactHeaderIndex(["FEE_AMOUNT", "MP_FEE_AMOUNT", "FEE"]);
    const settlementDateIdx = findExactHeaderIndex(["SETTLEMENT_DATE", "SETTLEMENT_DATE_TIME"]);
    const transactionDateIdx = findExactHeaderIndex(["TRANSACTION_DATE", "CREATED_DATE_TIME"]);
    const descIdx = findExactHeaderIndex(["DESCRIPTION"]);
    const refIdx = findExactHeaderIndex(["EXTERNAL_REFERENCE"]);

    if (sourceIdIdx === -1 || typeIdx === -1 || (settlementDateIdx === -1 && transactionDateIdx === -1) || (netAmountIdx === -1 && netCreditIdx === -1 && netDebitIdx === -1)) {
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
      if (valStr == null || valStr.trim() === "") return null;
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

      const rawSettlementDate = settlementDateIdx >= 0 ? cols[settlementDateIdx]?.trim() : "";
      const rawTransactionDate = transactionDateIdx >= 0 ? cols[transactionDateIdx]?.trim() : "";
      const rawDateStr = rawSettlementDate || rawTransactionDate || undefined;
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

      const parsedCreditVal = netCreditIdx >= 0 ? parseMonetaryValue(cols[netCreditIdx] || "0") : 0;
      const parsedDebitVal = netDebitIdx >= 0 ? parseMonetaryValue(cols[netDebitIdx] || "0") : 0;
      const parsedNetVal = netAmountIdx >= 0
        ? parseMonetaryValue(rawNetAmountStr)
        : parsedCreditVal === null || parsedDebitVal === null ? null : parsedCreditVal - Math.abs(parsedDebitVal);
      if (parsedNetVal === null) {
        rejectedCount++;
        errors.push(`Linha ${rowLineNum}: Rejeitada por formato numérico de valor líquido inválido.`);
        continue;
      }

      const parsedAmountVal = parseMonetaryValue(rawAmountStr || rawNetAmountStr || String(parsedNetVal));
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

