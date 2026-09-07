import test from "node:test";
import assert from "node:assert/strict";
import { EvolutionAPIClient, buildDebtorPixChargeMessage } from "../src/integrations/evolution-api/client.ts";

test("Evolution API WhatsApp: Formatação humanizada com motivo/título e remetente", async () => {
  let capturedBody = null;

  const client = new EvolutionAPIClient();
  // Mock do sendTextMessage para capturar a mensagem gerada
  client.sendTextMessage = async (input) => {
    capturedBody = input;
    return { success: true, messageId: "msg-test-123" };
  };

  const result = await client.sendPixChargeReminder({
    debtorName: "Juliano",
    debtorPhone: "62992053928",
    amountCents: 5000,
    dueDate: "10/09/2026",
    pixCopiaECola: "00020126580014br.gov.bcb.pix...",
    title: "IPTV",
    senderName: "Franklin Jr",
  });

  assert.equal(result.success, true);
  assert.ok(capturedBody);
  assert.equal(capturedBody.number, "62992053928");

  const text = capturedBody.text;
  assert.match(text, /Olá, \*Juliano\*! Tudo bem\?/);
  assert.match(text, /Aqui é o \*Franklin Jr\*\./);
  assert.match(text, /referente à cobrança sobre \*IPTV\*/);
  assert.match(text, /R\$\s*50,00/);
  assert.match(text, /10\/09\/2026/);
  assert.match(text, /00020126580014br\.gov\.bcb\.pix\.\.\./);
  assert.match(text, /reconhece a baixa automaticamente/);
  assert.match(text, /— \*Franklin Jr\*/);
});

test("Evolution API WhatsApp: Fallback limpo quando motivo não for fornecido", async () => {
  let capturedBody = null;

  const client = new EvolutionAPIClient();
  client.sendTextMessage = async (input) => {
    capturedBody = input;
    return { success: true, messageId: "msg-test-456" };
  };

  const result = await client.sendPixChargeReminder({
    debtorName: "Carlos",
    debtorPhone: "11999999999",
    amountCents: 12000,
    dueDate: "15/09/2026",
    pixCopiaECola: "PIX-CODE-123",
  });

  assert.equal(result.success, true);
  const text = capturedBody.text;
  assert.match(text, /Olá, \*Carlos\*! Tudo bem\?/);
  assert.match(text, /referente à cobrança da sua conta, no valor de/);
  assert.match(text, /R\$\s*120,00/);
});

test("buildDebtorPixChargeMessage: Função pura gera mensagem idêntica para envio e cópia", () => {
  const msg = buildDebtorPixChargeMessage({
    debtorName: "Juliano",
    amountCents: 3500,
    dueDate: "12/09/2026",
    pixCopiaECola: "00020126TESTE",
    title: "IPTV",
    senderName: "Franklin Jr",
  });

  assert.ok(msg.includes("Olá, *Juliano*! Tudo bem?"));
  assert.ok(msg.includes("Aqui é o *Franklin Jr*."));
  assert.ok(msg.includes("referente à cobrança sobre *IPTV*"));
  assert.ok(msg.includes("R$ 35,00") || msg.includes("R$\u00a035,00"));
  assert.ok(msg.includes("00020126TESTE"));
});

