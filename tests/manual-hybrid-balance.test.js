import test from "node:test";
import assert from "node:assert/strict";
import { calculateAnchoredBalance, calculateConsolidatedBalance } from "../src/domain/financial-balance.ts";

test("Conta manual: saldo inicial recebe créditos e débitos sem perder a âncora", () => {
  assert.equal(calculateAnchoredBalance(100_00, [
    { direction: "CREDIT", amountCents: 25_00 },
    { direction: "DEBIT", amountCents: 40_00 },
  ]), 85_00);
});

test("Híbrido: total é omitido sem saldo oficial do Mercado Pago", () => {
  assert.equal(calculateConsolidatedBalance({ mode: "HYBRID", manualBalanceCents: 85_00, mercadoPagoOfficialBalanceCents: null }), null);
  assert.equal(calculateConsolidatedBalance({ mode: "HYBRID", manualBalanceCents: 85_00, mercadoPagoOfficialBalanceCents: 15_00 }), 100_00);
});

test("Manual: saldo geral é o consolidado sem depender do Mercado Pago", () => {
  assert.equal(calculateConsolidatedBalance({ mode: "MANUAL", manualBalanceCents: 85_00, mercadoPagoOfficialBalanceCents: null }), 85_00);
});
