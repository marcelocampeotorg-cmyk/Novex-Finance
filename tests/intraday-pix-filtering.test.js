import test from "node:test";
import assert from "node:assert/strict";
import { MercadoPagoPaymentsClient } from "../src/integrations/mercado-pago/payments-client.ts";

test("Intraday Payments: Débito de empréstimo (account_money) é rejeitado e não vira crédito", () => {
  const client = new MercadoPagoPaymentsClient("TEST-TOKEN-1234567890");

  const loanPayment = {
    id: 176986817283,
    status: "approved",
    status_detail: "accredited",
    operation_type: "regular_payment",
    payment_type_id: "account_money",
    payment_method_id: "account_money",
    description: "Pagamento de parcelas de Mercado Crédito",
    transaction_amount: 94.98,
    point_of_interaction: {
      type: "CREDITS",
      business_info: { sub_unit: "core", unit: "credits" },
    },
  };

  const rawTx = client.mapPaymentToRawTransaction(loanPayment);
  assert.equal(rawTx, null, "Pagamento de empréstimo com saldo em conta (account_money) deve ser rejeitado");
});

test("Intraday Payments: Assinatura ou compra com saldo em conta é rejeitada pelo pipeline intradiário", () => {
  const client = new MercadoPagoPaymentsClient("TEST-TOKEN-1234567890");

  const subscriptionPayment = {
    id: 175714580829,
    status: "approved",
    status_detail: "accredited",
    operation_type: "recurring_payment",
    payment_type_id: "account_money",
    payment_method_id: "account_money",
    description: "Google One",
    transaction_amount: 9.99,
  };

  const rawTx = client.mapPaymentToRawTransaction(subscriptionPayment);
  assert.equal(rawTx, null, "Assinatura paga com saldo em conta deve ser rejeitada pelo pipeline intradiário");
});

test("Intraday Payments: Pix Recebido legítimo é capturado como CREDIT intradiário", () => {
  const client = new MercadoPagoPaymentsClient("TEST-TOKEN-1234567890");

  const realPix = {
    id: 177829977030,
    status: "approved",
    status_detail: "accredited",
    operation_type: "regular_payment",
    payment_type_id: "bank_transfer",
    payment_method_id: "pix",
    description: null,
    transaction_amount: 31.00,
    point_of_interaction: {
      business_info: { sub_unit: "money_inflows", unit: "digital_accounts_cards" },
      type: "PSP_TRANSFER",
      transaction_data: {
        bank_info: {
          payer: { long_name: "BANCO C6 S.A." },
        },
      },
    },
  };

  const rawTx = client.mapPaymentToRawTransaction(realPix);
  assert.ok(rawTx !== null, "Pix recebido legítimo deve ser mapeado");
  assert.equal(rawTx.direction, "CREDIT");
  assert.equal(rawTx.amountCents, 3100);
  assert.equal(rawTx.netAmountCents, 3100);
  assert.equal(rawTx.externalId, "177829977030_SETTLEMENT_CREDIT_3100");
});

test("Intraday Payments: Aporte de conta (account_fund) é capturado como CREDIT", () => {
  const client = new MercadoPagoPaymentsClient("TEST-TOKEN-1234567890");

  const accountFund = {
    id: 176567835904,
    status: "approved",
    status_detail: "accredited",
    operation_type: "account_fund",
    payment_type_id: "bank_transfer",
    payment_method_id: "pix",
    transaction_amount: 35.00,
  };

  const rawTx = client.mapPaymentToRawTransaction(accountFund);
  assert.ok(rawTx !== null, "Aporte via Pix deve ser mapeado como crédito");
  assert.equal(rawTx.direction, "CREDIT");
  assert.equal(rawTx.amountCents, 3500);
});
