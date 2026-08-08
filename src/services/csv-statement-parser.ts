import type { MercadoPagoRawTransaction } from "../integrations/mercado-pago/reports-client.ts";

export function parseCSVStatement(csvContent: string): MercadoPagoRawTransaction[] {
  if (!csvContent || !csvContent.trim()) {
    return [];
  }

  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }

  // Detectar separador (vírgula, ponto e vírgula ou tabulação)
  const headerLine = lines[0];
  let delimiter = ",";
  if (headerLine.includes(";")) delimiter = ";";
  else if (headerLine.includes("\t")) delimiter = "\t";

  const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));

  // Mapear índices das colunas relevantes
  const dateIdx = headers.findIndex((h) => h.includes("data") || h.includes("date") || h.includes("created"));
  const descIdx = headers.findIndex((h) => h.includes("desc") || h.includes("historico") || h.includes("title"));
  const amountIdx = headers.findIndex((h) => h.includes("valor") || h.includes("amount") || h.includes("monto"));
  const idIdx = headers.findIndex((h) => h.includes("id") || h.includes("transacao") || h.includes("external"));
  const counterpartIdx = headers.findIndex((h) => h.includes("nome") || h.includes("contraparte") || h.includes("cliente") || h.includes("counterpart"));
  const docIdx = headers.findIndex((h) => h.includes("cpf") || h.includes("cnpj") || h.includes("documento") || h.includes("doc"));
  const txidIdx = headers.findIndex((h) => h.includes("txid") || h.includes("pix"));
  const refIdx = headers.findIndex((h) => h.includes("ref") || h.includes("referencia"));
  const feeIdx = headers.findIndex((h) => h.includes("taxa") || h.includes("tarifa") || h.includes("fee"));
  const typeIdx = headers.findIndex((h) => h.includes("tipo") || h.includes("type"));

  const parsedTransactions: MercadoPagoRawTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (row.length === 0 || !row[0]) continue;

    const rawAmountStr = amountIdx !== -1 ? row[amountIdx] : "0";
    if (!rawAmountStr) continue;

    // Normalizar valor decimal BRL (ex: "1.250,50" -> 1250.50, "-45,00" -> -45.00)
    let cleanAmountStr = rawAmountStr.replace(/\s/g, "").replace("R$", "");
    let isNegative = cleanAmountStr.startsWith("-");
    if (isNegative) cleanAmountStr = cleanAmountStr.substring(1);

    if (cleanAmountStr.includes(",") && cleanAmountStr.includes(".")) {
      cleanAmountStr = cleanAmountStr.replace(/\./g, "").replace(",", ".");
    } else if (cleanAmountStr.includes(",")) {
      cleanAmountStr = cleanAmountStr.replace(",", ".");
    }

    const floatVal = parseFloat(cleanAmountStr);
    if (isNaN(floatVal) || floatVal === 0) continue;

    const amountCents = Math.round(floatVal * 100);
    const direction: "CREDIT" | "DEBIT" = isNegative ? "DEBIT" : "CREDIT";

    let feeCents = 0;
    if (feeIdx !== -1 && row[feeIdx]) {
      const cleanFee = row[feeIdx].replace(/\s/g, "").replace("R$", "").replace(",", ".");
      const feeVal = parseFloat(cleanFee);
      if (!isNaN(feeVal)) feeCents = Math.round(Math.abs(feeVal) * 100);
    }

    const description = descIdx !== -1 && row[descIdx] ? row[descIdx] : `Transação Extrato ${i}`;
    const externalId = idIdx !== -1 && row[idIdx] ? row[idIdx] : `CSV-EXT-${Date.now()}-${i}`;
    
    // Parse de data
    let occurredAtStr = new Date().toISOString();
    if (dateIdx !== -1 && row[dateIdx]) {
      const dateVal = row[dateIdx];
      // Tratar formato BR "DD/MM/YYYY" ou "DD/MM/YYYY HH:mm"
      if (dateVal.includes("/")) {
        const parts = dateVal.split(" ");
        const dParts = parts[0].split("/");
        if (dParts.length === 3) {
          const day = parseInt(dParts[0], 10);
          const month = parseInt(dParts[1], 10) - 1;
          const year = parseInt(dParts[2], 10);
          const timeParts = parts[1] ? parts[1].split(":") : ["12", "0"];
          const hour = parseInt(String(timeParts[0] || "12"), 10);
          const minute = parseInt(String(timeParts[1] || "0"), 10);
          const dt = new Date(year, month, day, hour, minute);
          if (!isNaN(dt.getTime())) occurredAtStr = dt.toISOString();
        }
      } else {
        const dt = new Date(dateVal);
        if (!isNaN(dt.getTime())) occurredAtStr = dt.toISOString();
      }
    }

    parsedTransactions.push({
      externalId,
      occurredAt: occurredAtStr,
      type: typeIdx !== -1 && row[typeIdx] ? row[typeIdx] : "CSV_IMPORT",
      description,
      direction,
      amountCents,
      feeCents,
      netAmountCents: amountCents - feeCents > 0 ? amountCents - feeCents : amountCents,
      counterpartName: counterpartIdx !== -1 ? row[counterpartIdx] : undefined,
      counterpartDocument: docIdx !== -1 ? row[docIdx] : undefined,
      txid: txidIdx !== -1 ? row[txidIdx] : undefined,
      rawReference: refIdx !== -1 ? row[refIdx] : undefined,
    });
  }

  return parsedTransactions;
}
