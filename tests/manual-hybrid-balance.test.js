import test from "node:test";
import assert from "node:assert/strict";
import { calculateAnchoredBalance, calculateConsolidatedBalance } from "../src/domain/financial-balance.ts";

test("Conta manual: saldo inicial recebe créditos e débitos sem perder a âncora", () => {
  assert.equal(calculateAnchoredBalance(100_00, [
    { direction: "CREDIT", amountCents: 25_00 },
    { direction: "DEBIT", amountCents: 40_00 },
  ]), 85_00);
});

test("Modo híbrido: não consolida enquanto o saldo oficial do Mercado Pago estiver em reconciliação", () => {
  assert.equal(calculateConsolidatedBalance({ mode: "HYBRID", manualBalanceCents: 85_00, mercadoPagoOfficialBalanceCents: null }), null);
});

test("Modo manual: o consolidado é o saldo da conta geral manual", () => {
  assert.equal(calculateConsolidatedBalance({ mode: "MANUAL", manualBalanceCents: 85_00, mercadoPagoOfficialBalanceCents: null }), 85_00);
});

test("Modo híbrido: soma somente os dois saldos comprovados", () => {
  assert.equal(calculateConsolidatedBalance({ mode: "HYBRID", manualBalanceCents: 85_00, mercadoPagoOfficialBalanceCents: 15_00 }), 100_00);
  assert.equal(calculateConsolidatedBalance({ mode: "HYBRID", manualBalanceCents: null, mercadoPagoOfficialBalanceCents: 15_00 }), null);
});
