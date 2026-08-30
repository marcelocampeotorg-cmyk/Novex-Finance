import crypto from "node:crypto";

export function assertReceivableDirection(direction: string): void {
  if (direction !== "RECEIVABLE") throw new Error("REGRA_DE_SEGURANCA: A Orders API só pode ser utilizada para Contas a Receber.");
}

export function getFixedChargeAmount(totalCents: number, settledCents: number): number {
  const remaining = totalCents - settledCents;
  if (!Number.isSafeInteger(remaining) || remaining <= 0) throw new Error("COBRANCA_SEM_SALDO_PENDENTE");
  return remaining;
}

export function getPixChargeIdempotencyKey(workspaceId: string, installmentId: string, amountCents: number, attempt = 1): string {
  const hash = crypto.createHash("sha256").update(`${workspaceId}:${installmentId}:${amountCents}:${attempt}`).digest("hex").slice(0, 12);
  return `nvx_idemp_${installmentId}_${hash}`;
}

export function classifyFixedChargePayment(expectedCents: number, receivedCents: number): "PAID" | "DIVERGENT" {
  return expectedCents === receivedCents ? "PAID" : "DIVERGENT";
}
