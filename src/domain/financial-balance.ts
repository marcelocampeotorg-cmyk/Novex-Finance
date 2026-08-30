export type SignedEntry = { direction: "CREDIT" | "DEBIT"; amountCents: number };

export function calculateAnchoredBalance(openingBalanceCents: number | null, entries: SignedEntry[]): number | null {
  if (openingBalanceCents === null) return null;
  return entries.reduce((balance, entry) => balance + (entry.direction === "CREDIT" ? entry.amountCents : -entry.amountCents), openingBalanceCents);
}

export function calculateConsolidatedBalance(input: {
  mode?: "MANUAL" | "HYBRID";
  manualBalanceCents?: number | null;
  mercadoPagoOfficialBalanceCents: number | null;
}): number | null {
  if (input.mercadoPagoOfficialBalanceCents === null || input.mercadoPagoOfficialBalanceCents === undefined) {
    return null;
  }
  return input.mercadoPagoOfficialBalanceCents;
}
