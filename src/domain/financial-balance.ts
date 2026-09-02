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
  const manualBalance = input.manualBalanceCents ?? null;

  if ((input.mode ?? "HYBRID") === "MANUAL") {
    return manualBalance;
  }

  const mercadoPagoBalance = input.mercadoPagoOfficialBalanceCents ?? null;
  if (manualBalance === null || mercadoPagoBalance === null) return null;

  return manualBalance + mercadoPagoBalance;
}
