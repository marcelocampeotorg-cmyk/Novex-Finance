import test from "node:test";
import assert from "node:assert/strict";
import {
  isMercadoPagoAccountStatementCsv,
  parseMercadoPagoAccountStatementCsv,
} from "../src/domain/mercado-pago-account-statement.ts";

const statement = `INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE
269,77;3.903,60;-4.035,71;137,66

RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE
02-09-2026;Pagamento com QR Pix FACEBOOK SERVICOS ONLINE DO BRASIL LTDA;175963571301;-12,52;78,19
02-09-2026;Pix recebido JOVANI ROSA DOS SANTOS;176866825828;75,00;153,19`;

test("Extrato de conta Mercado Pago preserva referência, valor assinado e contraparte oficial", () => {
  const result = parseMercadoPagoAccountStatementCsv(statement);
  assert.equal(result.rejectedCount, 0);
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records[0], {
    releaseDate: "2026-09-02T12:00:00.000Z",
    transactionType: "Pagamento com QR Pix FACEBOOK SERVICOS ONLINE DO BRASIL LTDA",
    referenceId: "175963571301",
    netAmountCents: 1252,
    direction: "DEBIT",
    counterpartName: "FACEBOOK SERVICOS ONLINE DO BRASIL LTDA",
  });
  assert.equal(result.records[1].direction, "CREDIT");
  assert.equal(result.records[1].netAmountCents, 7500);
});

test("Extrato de conta rejeita arquivo sem o cabeçalho oficial", () => {
  assert.equal(isMercadoPagoAccountStatementCsv("DATA;VALOR\n01/01/2026;10,00"), false);
});

test("Extrato de conta reconhece prefixos expandidos de transferência, contas e débito", async () => {
  const { toTitleCaseCounterpart } = await import("../src/domain/mercado-pago-account-statement.ts");

  const expandedStatement = `RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE
02-09-2026;Transferência Pix enviada AUTO PECAS GOIANIA LTDA;199283748291;-250,00;1000,00
02-09-2026;Pagamento de conta ENEL DISTRIBUICAO;188273645192;-185,40;814,60
02-09-2026;Compra no débito POSTO IPIRANGA;177263548193;-80,00;734,60`;

  const result = parseMercadoPagoAccountStatementCsv(expandedStatement);
  assert.equal(result.rejectedCount, 0);
  assert.equal(result.records.length, 3);
  assert.equal(result.records[0].counterpartName, "AUTO PECAS GOIANIA LTDA");
  assert.equal(toTitleCaseCounterpart(result.records[0].counterpartName), "Auto Pecas Goiania LTDA");
  assert.equal(result.records[1].counterpartName, "ENEL DISTRIBUICAO");
  assert.equal(result.records[2].counterpartName, "POSTO IPIRANGA");
});

