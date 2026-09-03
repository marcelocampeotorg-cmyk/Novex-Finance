import { parseCsvRows } from "../integrations/mercado-pago/reports-client.ts";

export interface MercadoPagoAccountStatementRecord {
  releaseDate: string;
  transactionType: string;
  referenceId: string;
  netAmountCents: number;
  direction: "CREDIT" | "DEBIT";
  counterpartName?: string;
}

export interface MercadoPagoAccountStatementParseResult {
  records: MercadoPagoAccountStatementRecord[];
  rejectedCount: number;
  errors: string[];
}

const REQUIRED_HEADERS = [
  "RELEASE_DATE",
  "TRANSACTION_TYPE",
  "REFERENCE_ID",
  "TRANSACTION_NET_AMOUNT",
  "PARTIAL_BALANCE",
];

function parseBrazilianCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function parseReleaseDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const LOWERCASE_WORDS = new Set(["de", "da", "do", "dos", "das", "e", "em", "para", "com", "por"]);
const UPPERCASE_ACRONYMS = new Set(["ltda", "sa", "s.a.", "s/a", "me", "epp", "eireli", "cpf", "cnpj", "ted", "doc", "qr", "pix", "iof", "irrf"]);

export function toTitleCaseCounterpart(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const words = trimmed.toLowerCase().split(/\s+/);
  return words
    .map((word, index) => {
      if (UPPERCASE_ACRONYMS.has(word)) return word.toUpperCase();
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const KNOWN_STATEMENT_PREFIXES = [
  "Pagamento com QR Pix ",
  "Pix recebido ",
  "Transferência Pix enviada ",
  "Transferência Pix recebida ",
  "Pix enviado ",
  "Pagamento de conta ",
  "Pagamento de boleto ",
  "Pagamento de contas ",
  "Pagamento com cartão de débito virtual ",
  "Compra no débito virtual ",
  "Compra no débito ",
  "TED enviada ",
  "TED recebida ",
  "DOC enviado ",
  "DOC recebido ",
];

function getCounterpartName(transactionType: string): string | undefined {
  const prefix = KNOWN_STATEMENT_PREFIXES.find((candidate) => transactionType.startsWith(candidate));
  if (!prefix) return undefined;
  const counterpart = transactionType.slice(prefix.length).trim();
  return counterpart || undefined;
}

/**
 * Lê exclusivamente o CSV "Extrato de conta" exportado pelo Mercado Pago.
 * Ele não representa um novo fato financeiro: serve somente para enriquecer
 * transações que já foram comprovadas pelo Relatório Dinheiro em Conta.
 */
export function parseMercadoPagoAccountStatementCsv(csvText: string): MercadoPagoAccountStatementParseResult {
  const { rows } = parseCsvRows(csvText);
  const headerIndex = rows.findIndex((row) =>
    REQUIRED_HEADERS.every((header) => row.map((value) => value.trim().toUpperCase()).includes(header)),
  );

  if (headerIndex < 0) {
    return {
      records: [],
      rejectedCount: 0,
      errors: ["O arquivo não é um Extrato de conta CSV reconhecido do Mercado Pago."],
    };
  }

  const headers = rows[headerIndex].map((value) => value.trim().toUpperCase());
  const indexOf = (header: string) => headers.indexOf(header);
  const dateIndex = indexOf("RELEASE_DATE");
  const typeIndex = indexOf("TRANSACTION_TYPE");
  const referenceIndex = indexOf("REFERENCE_ID");
  const amountIndex = indexOf("TRANSACTION_NET_AMOUNT");

  const records: MercadoPagoAccountStatementRecord[] = [];
  const errors: string[] = [];
  let rejectedCount = 0;

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const releaseDate = parseReleaseDate(row[dateIndex] || "");
    const transactionType = (row[typeIndex] || "").trim();
    const referenceId = (row[referenceIndex] || "").trim();
    const signedCents = parseBrazilianCents(row[amountIndex] || "");

    if (!releaseDate || !transactionType || !referenceId || signedCents === null || signedCents === 0) {
      rejectedCount++;
      errors.push(`Linha ${rowIndex + 1}: dados obrigatórios inválidos no Extrato de conta.`);
      continue;
    }

    records.push({
      releaseDate,
      transactionType,
      referenceId,
      netAmountCents: Math.abs(signedCents),
      direction: signedCents > 0 ? "CREDIT" : "DEBIT",
      counterpartName: getCounterpartName(transactionType),
    });
  }

  return { records, rejectedCount, errors };
}

export function isMercadoPagoAccountStatementCsv(csvText: string): boolean {
  return parseMercadoPagoAccountStatementCsv(csvText).errors.length === 0;
}
