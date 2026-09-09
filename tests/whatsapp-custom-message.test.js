import test from "node:test";
import assert from "node:assert/strict";
import { EvolutionAPIClient, buildDebtorPixChargeMessage } from "../src/integrations/evolution-api/client.ts";

test("Evolution API WhatsApp: Formatação humanizada com motivo/título e remetente", async () => {
  const capturedBodies = [];

  const client = new EvolutionAPIClient();
  // Mock do sendTextMessage para capturar as mensagens geradas
  client.sendTextMessage = async (input) => {
    capturedBodies.push(input);
    return { success: true, messageId: `msg-test-${capturedBodies.length}` };
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
  assert.equal(capturedBodies.length, 2, "Deve disparar 2 mensagens: 1 intro humanizada + 2 Pix isolado");
  assert.equal(capturedBodies[0].number, "62992053928");
  assert.equal(capturedBodies[1].number, "62992053928");

  // Mensagem 1: Apresentação, Motivo, Valor e Instruções com setas
  const text1 = capturedBodies[0].text;
  assert.match(text1, /Olá, \*Juliano\*! Tudo bem\?/);
  assert.match(text1, /Aqui é o \*Franklin Jr\*\./);
  assert.match(text1, /referente à cobrança sobre \*IPTV\*/);
  assert.match(text1, /R\$\s*50,00/);
  assert.match(text1, /10\/09\/2026/);
  assert.match(text1, /reconhece a baixa automaticamente/);
  assert.match(text1, /— \*Franklin Jr\*/);
  assert.match(text1, /👇 \*Copie o código Pix na mensagem logo abaixo/);

  // Mensagem 2: Exclusivamente a chave Pix para cópia fácil em 1 toque
  const text2 = capturedBodies[1].text;
  assert.equal(text2, "00020126580014br.gov.bcb.pix...");
});

test("Evolution API WhatsApp: Fallback limpo quando motivo não for fornecido", async () => {
  const capturedBodies = [];

  const client = new EvolutionAPIClient();
  client.sendTextMessage = async (input) => {
    capturedBodies.push(input);
    return { success: true, messageId: `msg-test-${capturedBodies.length}` };
  };

  const result = await client.sendPixChargeReminder({
    debtorName: "Carlos",
    debtorPhone: "11999999999",
    amountCents: 12000,
    dueDate: "15/09/2026",
    pixCopiaECola: "PIX-CODE-123",
  });

  assert.equal(result.success, true);
  assert.equal(capturedBodies.length, 2);
  const text1 = capturedBodies[0].text;
  assert.match(text1, /Olá, \*Carlos\*! Tudo bem\?/);
  assert.match(text1, /referente à cobrança da sua conta, no valor de/);
  assert.match(text1, /R\$\s*120,00/);
  assert.match(text1, /👇 \*Copie o código Pix na mensagem logo abaixo/);

  const text2 = capturedBodies[1].text;
  assert.equal(text2, "PIX-CODE-123");
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

