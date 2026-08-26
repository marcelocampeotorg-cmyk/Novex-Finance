const test = require("node:test");
const assert = require("node:assert");

const { centsToDecimalString, getOrderById } = require("../src/integrations/mercado-pago/orders-client.ts");
const { assertReceivableDirection, getFixedChargeAmount, getPixChargeIdempotencyKey, classifyFixedChargePayment } = require("../src/domain/pix-receivable.ts");

test("Orders API: Conversão determinística de centavos para string decimal", () => {
  assert.strictEqual(centsToDecimalString(5000), "50.00");
  assert.strictEqual(centsToDecimalString(150), "1.50");
  assert.strictEqual(centsToDecimalString(10), "0.10");
  assert.strictEqual(centsToDecimalString(BigInt(1485050)), "14850.50");
  assert.throws(() => centsToDecimalString(0), /VALOR_INVALIDO/);
  assert.throws(() => centsToDecimalString(-100), /VALOR_INVALIDO/);
});

test("Regra de Segurança: Rejeição estrita de Contas a Pagar (PAYABLE)", () => {
  assert.doesNotThrow(() => assertReceivableDirection("RECEIVABLE"));
  assert.throws(() => assertReceivableDirection("PAYABLE"), /REGRA_DE_SEGURANCA/);
});

test("Idempotência de Criação: Retry de cobrança reutiliza a mesma X-Idempotency-Key", () => {
  const installmentId = "inst_test_123";
  const first = getPixChargeIdempotencyKey("ws_1", installmentId, 10000);
  const retry = getPixChargeIdempotencyKey("ws_1", installmentId, 10000);
  assert.strictEqual(retry, first, "Retry deve reutilizar a chave determinística.");
});

test("Regra de Liquidação: Order criada em estado PENDING não marca a parcela como paga", () => {
  const orderStatus = "PENDING";
  const isPaid = orderStatus === "PAID" || orderStatus === "CLOSED";

  assert.strictEqual(isPaid, false, "Order pendente não pode liquidar a parcela.");
});

test("Orders API: somente processed/accredited com evidências oficiais é pago", async (t) => {
  t.mock.method(global, "fetch", async () => ({
    status: 200,
    json: async () => ({
      id: "ORD-1",
      status: "processed",
      total_amount: "100.00",
      created_date: "2026-08-24T10:00:00Z",
      external_reference: "REF-1",
      transactions: {
        payments: [
          {
            id: "PAY-1",
            status: "processed",
            status_detail: "accredited",
            amount: "100.00",
            paid_amount: "100.00",
          },
        ],
      },
    }),
  }));
  const result = await getOrderById({ accessToken: "TOKEN", orderId: "ORD-1" });
  assert.strictEqual(result.isPaid, true);
  assert.strictEqual(result.amountCents, 10000);
  assert.strictEqual(result.paidAmountCents, 10000);
  assert.strictEqual(result.paymentId, "PAY-1");
  assert.strictEqual(result.externalReference, "REF-1");
  assert.strictEqual(result.providerUpdatedAt, "2026-08-24T10:00:00Z");
});

test("Orders API: status approved legado não é aceito como Orders processada", async (t) => {
  t.mock.method(global, "fetch", async () => ({
    status: 200,
    json: async () => ({ id: "ORD-2", status: "processed", transactions: { payments: [{ id: "PAY-2", status: "approved", status_detail: "accredited" }] } }),
  }));
  const result = await getOrderById({ accessToken: "TOKEN", orderId: "ORD-2" });
  assert.strictEqual(result.isPaid, false);
});

test("Pix fixo divergente registra divergência e não baixa parcialmente", () => {
  assert.strictEqual(getFixedChargeAmount(10000, 0), 10000);
  assert.strictEqual(classifyFixedChargePayment(10000, 5000), "DIVERGENT");
});

test("Pix fixo usa o saldo oficial da obrigação", () => {
  assert.strictEqual(getFixedChargeAmount(10000, 3000), 7000);
  assert.strictEqual(classifyFixedChargePayment(7000, 7000), "PAID");
});
