"use server";

import { db } from "@/server/db";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

/**
 * Sanitiza valores contra CSV Injection (=, +, -, @, \t, \r no início da célula).
 */
function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);

  // Sanitização de injeção CSV
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escapar aspas duplas
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export async function generateTransactionsCsv(): Promise<{ success: boolean; csvContent?: string; filename?: string; error?: string }> {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const transactions = await db.externalTransaction.findMany({
      where: { workspaceId, quarantinedAt: null },
      orderBy: { occurredAt: "desc" },
    });

    const headers = [
      "ID",
      "Data",
      "Provedor",
      "Origem",
      "Tipo",
      "Direção",
      "Descrição",
      "Contraparte",
      "Documento Contraparte",
      "Valor Bruto (R$)",
      "Tarifa (R$)",
      "Valor Líquido (R$)",
      "Status",
    ];

    const rows = transactions.map((tx) => [
      sanitizeCsvCell(tx.id),
      sanitizeCsvCell(tx.occurredAt.toISOString()),
      sanitizeCsvCell(tx.provider),
      sanitizeCsvCell(tx.source),
      sanitizeCsvCell(tx.type),
      sanitizeCsvCell(tx.direction),
      sanitizeCsvCell(tx.description),
      sanitizeCsvCell(tx.counterpartName || ""),
      sanitizeCsvCell(tx.counterpartDocument || ""),
      sanitizeCsvCell((Number(tx.amountCents) / 100).toFixed(2)),
      sanitizeCsvCell((Number(tx.feeCents || 0) / 100).toFixed(2)),
      sanitizeCsvCell((Number(tx.netAmountCents) / 100).toFixed(2)),
      sanitizeCsvCell(tx.status),
    ]);

    // BOM UTF-8 para garantir compatibilidade com Excel em PT-BR
    const utf8BOM = "\uFEFF";
    const csvContent = utf8BOM + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const filename = `novex_movimentacoes_${new Date().toISOString().slice(0, 10)}.csv`;

    return {
      success: true,
      csvContent,
      filename,
    };
  } catch (error: any) {
    console.error("Erro ao gerar exportação CSV:", error);
    return {
      success: false,
      error: error.message || "Falha ao gerar arquivo CSV.",
    };
  }
}
