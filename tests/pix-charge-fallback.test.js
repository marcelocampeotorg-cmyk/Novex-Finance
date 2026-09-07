import test from "node:test";
import assert from "node:assert/strict";

function resolveDebtorEmail(contact, installmentId) {
  const contactEmail = contact?.email?.trim();
  return contactEmail && contactEmail.includes("@")
    ? contactEmail
    : `cobranca.${contact?.id || installmentId}@finance.novexbr.com.br`;
}

test("Pix Receivables: Contato com e-mail válido utiliza o próprio e-mail", () => {
  const contact = { id: "c-1", name: "Juliano", email: "juliano@teste.com", phone: "62992053928" };
  const email = resolveDebtorEmail(contact, "inst-1");
  assert.equal(email, "juliano@teste.com");
});

test("Pix Receivables: Contato sem e-mail utiliza fallback técnico válido para Orders API", () => {
  const contact = { id: "c-2", name: "Juliano IPTV", email: null, phone: "62992053928" };
  const email = resolveDebtorEmail(contact, "inst-2");
  assert.equal(email, "cobranca.c-2@finance.novexbr.com.br");
  assert.ok(email.includes("@"));
});

test("Pix Receivables: Contato com e-mail em branco/espaços utiliza fallback técnico válido", () => {
  const contact = { id: "c-3", name: "Cliente WhatsApp", email: "   ", phone: "62992053928" };
  const email = resolveDebtorEmail(contact, "inst-3");
  assert.equal(email, "cobranca.c-3@finance.novexbr.com.br");
});
