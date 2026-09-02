import { parseCsvRows } from "./reports-client.ts";

export type ReleaseReportTaskStatus = "PROCESSING" | "READY" | "FAILED";

export interface ReleaseReportTask {
  taskId: string;
  status: ReleaseReportTaskStatus;
  fileName?: string;
  reportId?: string;
  beginDate?: string;
  endDate?: string;
}

export interface ReleaseBalanceEvidence {
  valid: boolean;
  balanceCents: number | null;
  initialBalanceCents: number | null;
  movementCents: number | null;
  balanceAt: string | null;
  rowCount: number;
  recordTypeCounts: Record<string, number>;
  errors: string[];
}

const RELEASE_REPORT_URL = "https://api.mercadopago.com/v1/account/release_report";

function normalizedStatus(value: unknown): ReleaseReportTaskStatus {
  const status = String(value || "").toLowerCase();
  if (["processed", "available", "ready"].includes(status)) return "READY";
  if (["failed", "error", "cancelled"].includes(status)) return "FAILED";
  return "PROCESSING";
}

function isoWithoutMs(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function apiError(response: Response, operation: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  const detail = String(body?.message || body?.error || "").trim();
  return new Error(`${operation}: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`);
}

export class MercadoPagoReleaseReportsClient {
  private readonly accessToken: string;

  constructor(accessToken: string) {
    if (!accessToken || ["DEMO_TOKEN", "REMOVIDO"].includes(accessToken)) {
      throw new Error("MercadoPagoReleaseReportsClient requer accessToken válido.");
    }
    this.accessToken = accessToken;
  }

  private headers(contentType = false): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      ...(contentType ? { "Content-Type": "application/json" } : {}),
    };
  }

  async ensureConfig(): Promise<void> {
    const requiredColumns = [
      "DATE",
      "SOURCE_ID",
      "EXTERNAL_REFERENCE",
      "RECORD_TYPE",
      "DESCRIPTION",
      "NET_CREDIT_AMOUNT",
      "NET_DEBIT_AMOUNT",
      "GROSS_AMOUNT",
      "MP_FEE_AMOUNT",
      "FINANCING_FEE_AMOUNT",
      "SHIPPING_FEE_AMOUNT",
      "TAXES_AMOUNT",
      "COUPON_AMOUNT",
      "INSTALLMENTS",
      "PAYMENT_METHOD",
      "BALANCE_AMOUNT",
    ].map((key) => ({ key }));

    const desired = {
      file_name_prefix: "novex-release",
      display_timezone: "GMT-03",
      // A configuração oficial do Release Report aceita a cadência mensal;
      // relatórios sob demanda continuam sendo gerados por POST para qualquer janela válida.
      frequency: { type: "monthly", value: 1, hour: 0 },
      separator: ";",
      scheduled: false,
      include_withdrawal_at_end: true,
      execute_after_withdrawal: false,
      check_available_balance: false,
      compensate_detail: true,
      columns: requiredColumns,
    };

    const currentResponse = await fetch(`${RELEASE_REPORT_URL}/config`, { headers: this.headers() });
    if (currentResponse.ok) {
      const current = await currentResponse.json();
      const currentColumns: Array<{ key: string; alias?: string }> = Array.isArray(current.columns) ? current.columns : [];
      const keys = new Set(currentColumns.map((column) => String(column?.key || "")));
      const missing = requiredColumns.filter((column) => !keys.has(column.key));
      if (missing.length === 0 && current.include_withdrawal_at_end === true) return;

      const updatePayload = {
        file_name_prefix: String(current.file_name_prefix || desired.file_name_prefix),
        display_timezone: String(current.display_timezone || desired.display_timezone),
        frequency: current.frequency || desired.frequency,
        separator: String(current.separator || desired.separator),
        scheduled: false,
        include_withdrawal_at_end: true,
        execute_after_withdrawal: false,
        check_available_balance: false,
        compensate_detail: true,
        columns: [...currentColumns, ...missing],
      };
      const updateResponse = await fetch(`${RELEASE_REPORT_URL}/config`, {
        method: "PUT",
        headers: this.headers(true),
        body: JSON.stringify(updatePayload),
      });
      if (!updateResponse.ok) throw await apiError(updateResponse, "Falha ao atualizar release_report/config");
      return;
    }

    if (currentResponse.status !== 404) throw await apiError(currentResponse, "Falha ao consultar release_report/config");

    const createResponse = await fetch(`${RELEASE_REPORT_URL}/config`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(desired),
    });
    if (!createResponse.ok && createResponse.status !== 409) {
      throw await apiError(createResponse, "Falha ao criar release_report/config");
    }
  }

  async requestReport(beginDate: Date, endDate: Date): Promise<ReleaseReportTask> {
    await this.ensureConfig();
    const existing = await this.findExistingReport(beginDate, endDate);
    if (existing) return existing;
    const response = await fetch(RELEASE_REPORT_URL, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({ begin_date: isoWithoutMs(beginDate), end_date: isoWithoutMs(endDate) }),
    });
    if (!response.ok) throw await apiError(response, "Falha ao solicitar release_report");
    const data = await response.json();
    const taskId = data.id != null ? String(data.id) : "";
    if (!taskId) throw new Error("Mercado Pago não retornou o id da tarefa do release_report.");
    return {
      taskId,
      status: normalizedStatus(data.status),
      fileName: data.file_name || undefined,
      reportId: data.report_id != null ? String(data.report_id) : undefined,
      beginDate: data.begin_date || undefined,
      endDate: data.end_date || undefined,
    };
  }

  async findExistingReport(beginDate: Date, endDate: Date): Promise<ReleaseReportTask | null> {
    const response = await fetch(`${RELEASE_REPORT_URL}/list`, { headers: this.headers() });
    if (!response.ok) throw await apiError(response, "Falha ao listar release_reports antes da criação");
    const data = await response.json();
    const reports = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
    const beginMs = beginDate.getTime();
    const endMs = endDate.getTime();
    const matches = reports.filter((item: any) => {
      const itemBegin = new Date(String(item?.begin_date || "")).getTime();
      const itemEnd = new Date(String(item?.end_date || "")).getTime();
      return Number.isFinite(itemBegin) && Number.isFinite(itemEnd) && itemBegin === beginMs && itemEnd === endMs;
    });
    if (matches.length === 0) return null;
    matches.sort((left: any, right: any) => {
      const leftAt = new Date(String(left?.generation_date || left?.last_modified || 0)).getTime();
      const rightAt = new Date(String(right?.generation_date || right?.last_modified || 0)).getTime();
      return rightAt - leftAt;
    });
    const report = matches[0];
    const taskId = report?.id != null ? String(report.id) : "";
    if (!taskId) return null;
    return {
      taskId,
      status: normalizedStatus(report.status),
      fileName: report.file_name || undefined,
      reportId: report.report_id != null ? String(report.report_id) : undefined,
      beginDate: report.begin_date || undefined,
      endDate: report.end_date || undefined,
    };
  }

  async getTask(taskId: string): Promise<ReleaseReportTask> {
    if (!taskId.trim()) throw new Error("taskId obrigatório para consultar release_report.");
    const response = await fetch(`${RELEASE_REPORT_URL}/task/${encodeURIComponent(taskId)}`, { headers: this.headers() });
    if (!response.ok) throw await apiError(response, "Falha ao consultar tarefa do release_report");
    const data = await response.json();
    const csvFile = Array.isArray(data.files) ? data.files.find((file: any) => file?.type === "csv") : undefined;
    return {
      taskId,
      status: normalizedStatus(data.status),
      fileName: data.file_name || csvFile?.name || undefined,
      reportId: data.report_id != null ? String(data.report_id) : data.id != null ? String(data.id) : undefined,
      beginDate: data.begin_date || undefined,
      endDate: data.end_date || undefined,
    };
  }

  async download(fileName: string): Promise<string> {
    if (!fileName.trim()) throw new Error("fileName obrigatório para baixar release_report.");
    const response = await fetch(`${RELEASE_REPORT_URL}/${encodeURIComponent(fileName)}`, { headers: this.headers() });
    if (!response.ok) throw await apiError(response, "Falha ao baixar release_report");
    return response.text();
  }

  parseBalance(csvText: string): ReleaseBalanceEvidence {
    const invalid = (errors: string[], rowCount = 0, recordTypeCounts: Record<string, number> = {}): ReleaseBalanceEvidence => ({
      valid: false,
      balanceCents: null,
      initialBalanceCents: null,
      movementCents: null,
      balanceAt: null,
      rowCount,
      recordTypeCounts,
      errors,
    });
    if (!csvText.trim()) return invalid(["Relatório Liberações vazio."]);

    const { rows } = parseCsvRows(csvText);
    if (rows.length < 2) return invalid(["Relatório Liberações sem linhas de dados."]);
    const headers = rows[0].map((header) => header.trim().toUpperCase());
    const index = (name: string) => headers.indexOf(name);
    const typeIndex = index("RECORD_TYPE");
    const creditIndex = index("NET_CREDIT_AMOUNT");
    const debitIndex = index("NET_DEBIT_AMOUNT");
    const dateIndex = index("DATE");
    const balanceIndex = index("BALANCE_AMOUNT");
    if ([typeIndex, creditIndex, debitIndex, dateIndex, balanceIndex].some((value) => value < 0)) {
      return invalid(["Relatório Liberações sem DATE, RECORD_TYPE, NET_CREDIT_AMOUNT, NET_DEBIT_AMOUNT ou BALANCE_AMOUNT."], rows.length - 1);
    }

    const parseMoney = (value: string | undefined): number | null => {
      const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
      if (normalized === "") return 0;
      if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
      const numeric = Number(normalized);
      return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
    };

    const typeCounts: Record<string, number> = {};
    const initialRows: number[] = [];
    let releaseMovementCents = 0;
    const balanceSnapshots: Array<{ at: Date; cents: number }> = [];
    const errors: string[] = [];

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const recordType = String(row[typeIndex] || "").trim().toLowerCase();
      if (!recordType) {
        errors.push(`Linha ${rowIndex + 1}: RECORD_TYPE ausente.`);
        continue;
      }
      const credit = parseMoney(row[creditIndex]);
      const debit = parseMoney(row[debitIndex]);
      if (credit === null || debit === null) {
        errors.push(`Linha ${rowIndex + 1}: valor monetário inválido.`);
        continue;
      }
      const signed = credit - Math.abs(debit);
      typeCounts[recordType] = (typeCounts[recordType] || 0) + 1;
      if (recordType === "initial_available_balance") initialRows.push(signed);
      else if (recordType === "release") releaseMovementCents += signed;

      const rawBalance = String(row[balanceIndex] ?? "").trim();
      // Linhas de total/subtotal são agregados contábeis e podem não ter DATE financeiro.
      // Somente eventos/snapshots datados podem ancorar o saldo.
      if (rawBalance && !["total", "subtotal"].includes(recordType)) {
        const balance = parseMoney(rawBalance);
        const at = new Date(String(row[dateIndex] || ""));
        if (balance === null || Number.isNaN(at.getTime())) errors.push(`Linha ${rowIndex + 1}: BALANCE_AMOUNT ou DATE inválido.`);
        else balanceSnapshots.push({ at, cents: balance });
      }
    }

    if (errors.length) return invalid(errors, rows.length - 1, typeCounts);
    if (initialRows.length !== 1) errors.push(`Esperado 1 initial_available_balance; recebido ${initialRows.length}.`);
    if (balanceSnapshots.length === 0) errors.push("Nenhum BALANCE_AMOUNT oficial foi encontrado.");
    if (errors.length) return invalid(errors, rows.length - 1, typeCounts);

    const initialBalanceCents = initialRows[0];
    balanceSnapshots.sort((left, right) => left.at.getTime() - right.at.getTime());
    const latestBalance = balanceSnapshots.at(-1)!;

    return {
      valid: true,
      balanceCents: latestBalance.cents,
      initialBalanceCents,
      movementCents: releaseMovementCents,
      balanceAt: latestBalance.at.toISOString(),
      rowCount: rows.length - 1,
      recordTypeCounts: typeCounts,
      errors: [],
    };
  }
}
