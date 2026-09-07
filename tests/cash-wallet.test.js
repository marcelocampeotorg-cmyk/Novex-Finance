import test from "node:test";
import assert from "node:assert/strict";

/**
 * Simulação determinística do domínio de ajuste de carteira
 */
function simulateCashWalletAdjustment({
  currentBalanceCents,
  realCountedCents,
  description,
}) {
  const diffCents = realCountedCents - currentBalanceCents;

  if (diffCents === 0) {
    return {
      success: true,
      diffCents: 0,
      newBalanceCents: realCountedCents,
      actionRequired: false,
    };
  }

  const direction = diffCents > 0 ? "CREDIT" : "DEBIT";
  const amountCents = Math.abs(diffCents);

  const defaultDesc = direction === "DEBIT"
    ? (description || "Despesas diversas em espécie / Carteira física")
    : (description || "Aporte ou sobra de dinheiro em espécie");

  const fullDescription = `Conferência de Carteira (${direction === "DEBIT" ? "Saída" : "Entrada"}) — ${defaultDesc}`;

  const newBalance = currentBalanceCents + (direction === "CREDIT" ? amountCents : -amountCents);

  return {
    success: true,
    actionRequired: true,
    direction,
    amountCents,
    fullDescription,
    newBalanceCents: newBalance,
  };
}

test("Conferência de Carteira: quando valor contado for menor (ex: 250 -> 120), gera DEBIT de R$ 130", () => {
  const res = simulateCashWalletAdjustment({
    currentBalanceCents: 25000,
    realCountedCents: 12000,
    description: "Casamento do Alex",
  });

  assert.equal(res.success, true);
  assert.equal(res.actionRequired, true);
  assert.equal(res.direction, "DEBIT");
  assert.equal(res.amountCents, 13000);
  assert.equal(res.newBalanceCents, 12000);
  assert.match(res.fullDescription, /Casamento do Alex/);
  assert.match(res.fullDescription, /Saída/);
});

test("Conferência de Carteira: quando valor contado for maior (ex: 120 -> 150), gera CREDIT de R$ 30", () => {
  const res = simulateCashWalletAdjustment({
    currentBalanceCents: 12000,
    realCountedCents: 15000,
    description: "Troco da feira guardado",
  });

  assert.equal(res.success, true);
  assert.equal(res.actionRequired, true);
  assert.equal(res.direction, "CREDIT");
  assert.equal(res.amountCents, 3000);
  assert.equal(res.newBalanceCents, 15000);
  assert.match(res.fullDescription, /Entrada/);
});

test("Conferência de Carteira: quando valor contado for igual, não gera movimentação (no-op)", () => {
  const res = simulateCashWalletAdjustment({
    currentBalanceCents: 12000,
    realCountedCents: 12000,
  });

  assert.equal(res.success, true);
  assert.equal(res.actionRequired, false);
  assert.equal(res.diffCents, 0);
});
