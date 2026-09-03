/**
 * Módulo de Indexação Exclusiva para Pensão Alimentícia por Salário Mínimo Vigente
 * 
 * Regra de negócio: A pensão alimentícia é calculada com base em percentual do
 * salário mínimo nacional (ex: 53% de R$ 1.621,00 = R$ 859,13).
 * Na virada de ano / reajuste oficial, todas as parcelas futuras em aberto são
 * atualizadas proporcionalmente, preservando o histórico já liquidado.
 */

export const DEFAULT_MINIMUM_WAGE_CENTS = 162100; // R$ 1.621,00 (Piso Nacional de Referência)
export const DEFAULT_PENSION_PERCENTAGE = 53; // 53%

/**
 * Calcula o valor da parcela em centavos a partir do salário mínimo e do percentual
 */
export function calculatePensionInstallmentCents(minimumWageCents: number, percentage: number): number {
  if (minimumWageCents <= 0 || percentage <= 0) return 0;
  return Math.round(minimumWageCents * (percentage / 100));
}

/**
 * Constrói a tag técnica persistida no FinancialItem
 */
export function buildPensionIndexerTag(percentage: number, minimumWageCents: number): string {
  return `[INDEXER:MINIMUM_WAGE;PERCENT:${percentage};BASE_WAGE:${minimumWageCents}]`;
}

/**
 * Extrai os parâmetros de indexação da descrição da conta
 */
export function parsePensionIndexerTag(description?: string | null): {
  isIndexed: boolean;
  percentage?: number;
  baseWageCents?: number;
} {
  if (!description) return { isIndexed: false };

  const match = description.match(/\[INDEXER:MINIMUM_WAGE;PERCENT:([0-9.]+);BASE_WAGE:([0-9]+)\]/);
  if (!match) return { isIndexed: false };

  const percentage = parseFloat(match[1]);
  const baseWageCents = parseInt(match[2], 10);

  return {
    isIndexed: true,
    percentage: isNaN(percentage) ? DEFAULT_PENSION_PERCENTAGE : percentage,
    baseWageCents: isNaN(baseWageCents) ? DEFAULT_MINIMUM_WAGE_CENTS : baseWageCents,
  };
}

/**
 * Verifica se um item financeiro é exclusivo de pensão alimentícia
 */
export function isPensionItem(title: string, description?: string | null): boolean {
  const normTitle = (title || "").toLowerCase();
  const normDesc = (description || "").toLowerCase();

  return (
    normTitle.includes("pens") ||
    normDesc.includes("pens") ||
    normDesc.includes("indexer:minimum_wage")
  );
}
