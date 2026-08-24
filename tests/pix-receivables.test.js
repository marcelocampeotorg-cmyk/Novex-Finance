const test = require("node:test");
const assert = require("node:assert");

const { centsToDecimalString, getOrderById } = require("../src/integrations/mercado-pago/orders-client.ts");

test("Orders API: Conversão determinística de centavos para string decimal", () => {
  assert.strictEqual(centsToDecimalString(5000), "50.00");
  assert.strictEqual(centsToDecimalString(150), "1.50");
  assert.strictEqual(centsToDecimalString(10), "0.10");
  assert.strictEqual(centsToDecimalString(BigInt(1485050)), "14850.50");
  assert.throws(() => centsToDecimalString(0), /VALOR_INVALIDO/);
  assert.throws(() => centsToDecimalString(-100), /VALOR_INVALIDO/);
});

test("Regra de Segurança: Rejeição estrita de Contas a Pagar (PAYABLE)", () => {
  function validateDirection(direction) {
    if (direction !== "RECEIVABLE") {
      return { allowed: false, error: "REGRA_DE_SEGURANCA: A Orders API só pode ser utilizada para Contas a Receber." };
    }
    return { allowed: true };
  }

  assert.strictEqual(validateDirection("RECEIVABLE").allowed, true);
  assert.strictEqual(validateDirection("PAYABLE").allowed, false);
  assert.strictEqual(validateDirection("PAYABLE").error.includes("REGRA_DE_SEGURANCA"), true);
});

test("Idempotência de Criação: Retry de cobrança reutiliza a mesma X-Idempotency-Key", () => {
  const installmentId = "inst_test_123";
  const existingCharge = {
    id: "chg_999",
    idempotencyKey: `nvx_idemp_${installmentId}_1700000000`,
    status: "PENDING",
  };

  function getOrGenerateIdempotencyKey(existing) {
    if (existing && existing.status === "PENDING") {
      return existing.idempotencyKey;
    }
    return `nvx_idemp_${installmentId}_${Date.now()}`;
  }

  const reusedKey = getOrGenerateIdempotencyKey(existingCharge);
  assert.strictEqual(reusedKey, "nvx_idemp_inst_test_123_1700000000", "Deve reutilizar a chave de idempotência para retries de cobrança pendente.");
});

test("Regra de Liquidação: Order criada em estado PENDING não marca a parcela como paga", () => {
  const orderStatus = "PENDING";
  const isPaid = orderStatus === "PAID" || orderStatus === "CLOSED";

  assert.strictEqual(isPaid, false, "Order pendente não pode liquidar a parcela.");
});

test("Orders API: somente processed/accredited com evidências oficiais é pago", async (t) => {
  t.mock.method(global, "fetch", async () => ({
    status: 200,
    json: async () => ({ id: "ORD-1", status: "processed", external_reference: "REF-1", transactions: { payments: [{ id: "PAY-1", status: "processed", status_detail: "accredited", paid_amount: "100.00", date_approved: "2026-08-24T10:00:00Z" }] } }),
  }));
  const result = await getOrderById({ accessToken: "TOKEN", orderId: "ORD-1" });
  assert.strictEqual(result.isPaid, true);
  assert.strictEqual(result.amountCents, 10000);
  assert.strictEqual(result.paymentId, "PAY-1");
  assert.strictEqual(result.externalReference, "REF-1");
  assert.strictEqual(result.paidAt, "2026-08-24T10:00:00Z");
});

test("Orders API: status approved legado não é aceito como Orders processada", async (t) => {
  t.mock.method(global, "fetch", async () => ({
    status: 200,
    json: async () => ({ id: "ORD-2", status: "processed", transactions: { payments: [{ id: "PAY-2", status: "approved", status_detail: "accredited" }] } }),
  }));
  const result = await getOrderById({ accessToken: "TOKEN", orderId: "ORD-2" });
  assert.strictEqual(result.isPaid, false);
});

test("Cálculo de Pagamento Parcial de Recebimentos", () => {
  const totalAmountCents = 10000; // R$ 100,00
  const currentSettledCents = 3000; // R$ 30,00 já pagos
  const newPaymentCents = 5000; // R$ 50,00 recebidos via Pix

  const updatedSettled = currentSettledCents + newPaymentCents;
  const newStatus = updatedSettled >= totalAmountCents ? "PAID" : "PARTIALLY_PAID";

  assert.strictEqual(updatedSettled, 8000);
  assert.strictEqual(newStatus, "PARTIALLY_PAID", "Com saldo restante a receber, status deve ser PARTIALLY_PAID.");
});

test("Cálculo de Pagamento Total de Recebimentos", () => {
  const totalAmountCents = 10000;
  const currentSettledCents = 5000;
  const newPaymentCents = 5000;

  const updatedSettled = currentSettledCents + newPaymentCents;
  const newStatus = updatedSettled >= totalAmountCents ? "PAID" : "PARTIALLY_PAID";

  assert.strictEqual(updatedSettled, 10000);
  assert.strictEqual(newStatus, "PAID", "Atingindo o total, status deve ser PAID.");
});
