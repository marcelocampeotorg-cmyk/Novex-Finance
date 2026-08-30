import test from "node:test";
import assert from "node:assert/strict";
import { calculateAnchoredBalance, calculateConsolidatedBalance } from "../src/domain/financial-balance.ts";

test("Conta manual: saldo inicial recebe créditos e débitos sem perder a âncora", () => {
  assert.equal(calculateAnchoredBalance(100_00, [
    { direction: "CREDIT", amountCents: 25_00 },
    { direction: "DEBIT", amountCents: 40_00 },
  ]), 85_00);
});

test("Saldo Consolidado V1: Retorna null quando o saldo oficial do Mercado Pago estiver em reconciliação", () => {
  assert.equal(calculateConsolidatedBalance({ mode: "HYBRID", manualBalanceCents: 85_00, mercadoPagoOfficialBalanceCents: null }), null);
  assert.equal(calculateConsolidatedBalance({ mode: "MANUAL", manualBalanceCents: 85_00, mercadoPagoOfficialBalanceCents: null }), null);
});

test("Saldo Consolidado V1: Reflete estritamente o saldo oficial quando confirmado", () => {
  assert.equal(calculateConsolidatedBalance({ mode: "HYBRID", manualBalanceCents: 85_00, mercadoPagoOfficialBalanceCents: 15_00 }), 15_00);
});
