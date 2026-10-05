import { buildDebtorPixChargeMessage } from "@/integrations/evolution-api/client";

export interface AICallbackInput {
  debtorName: string;
  amountCents: number;
  dueDate: string;
  pixCopiaECola?: string | null;
  title?: string;
  description?: string;
  senderName?: string;
}

export interface AIGenerationResult {
  message: string;
  usedAI: boolean;
  model?: string;
  error?: string;
}

/**
 * Serviço de geração de mensagens de cobrança e atendimento humanizado com IA (Groq).
 * Utiliza LLMs ultrarrápidas da Groq (ex: openai/gpt-oss-120b ou qwen/qwen3.8-27b)
 * com fallback automático e resiliente para template padrão caso a API esteja indisponível.
 */
export async function generateAIPixChargeMessage(input: AICallbackInput): Promise<AIGenerationResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";

  // Se não houver chave configurada, aplicar fallback imediato
  if (!apiKey) {
    return {
      message: buildDebtorPixChargeMessage({
        debtorName: input.debtorName,
        amountCents: input.amountCents,
        dueDate: input.dueDate,
        pixCopiaECola: input.pixCopiaECola || undefined,
        title: input.title,
        description: input.description,
        senderName: input.senderName,
      }),
      usedAI: false,
    };
  }

  const valorFormatted = (input.amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const sender = input.senderName?.trim() || "Frank Oliveira";
  const motivo = input.title?.trim() || "sua conta";
  const detalhes = input.description?.trim() ? `Detalhes adicionais: ${input.description.trim()}` : "";
  const pixCode = input.pixCopiaECola?.trim() || "";

  const systemPrompt = `Você é a assistente virtual de atendimento e finanças do ${sender} no sistema NOVEX Finance.
Sua missão é redigir uma mensagem de cobrança amigável, educada e profissional para ser enviada pelo WhatsApp.

DIRETRIZES OBRIGATÓRIAS:
1. Tom: Acolhedor, simpático, respeitoso e direto (sem burocracia excessiva e sem ameaças ou termos jurídicos pesados).
2. Apresentação: Cumprimente o cliente pelo nome (${input.debtorName}) e apresente-se com naturalidade como a inteligência artificial / assistente virtual do ${sender} (NOVEX Finance).
3. Motivo e Valores: Informe o motivo da cobrança (${motivo}), o valor exato (${valorFormatted}) e o vencimento (${input.dueDate}).
4. Facilidade Pix: Explique gentilmente que o pagamento pode ser feito pelo Pix e que, após pagar, o sistema reconhece a baixa automaticamente.
5. Código Pix: Inclua o código Pix Copia e Cola em um bloco de código Markdown (\`\`\`codigo\`\`\`) para facilitar a cópia no celular.
6. Encerramento: Finalize com cordialidade colocando-se à disposição.
7. Formatação WhatsApp: Use formatação nativa do WhatsApp (*negrito*, _itálico_).
8. RETORNE EXCLUSIVAMENTE o texto final da mensagem pronta para disparo, sem comentários adicionais seus antes ou depois.`;

  const userPrompt = `Dados da cobrança:
- Cliente: ${input.debtorName}
- Motivo: ${motivo}
${detalhes ? `- ${detalhes}` : ""}
- Valor: ${valorFormatted}
- Vencimento: ${input.dueDate}
${pixCode ? `- Código Pix Copia e Cola: ${pixCode}` : "- (Chave Pix será enviada em seguida)"}

Por favor, elabore a mensagem amigável de cobrança agora.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 segundos de timeout estrito

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "NOVEX-Finance-AI/1.0",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`[Groq AI Warning] Resposta ${response.status} da Groq:`, errText);
      throw new Error(`Groq HTTP ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data?.choices?.[0]?.message?.content?.trim();

    if (!generatedText || generatedText.length < 20) {
      throw new Error("Resposta da Groq muito curta ou vazia");
    }

    return {
      message: generatedText,
      usedAI: true,
      model,
    };
  } catch (error: any) {
    console.warn("[Groq AI Fallback] Recorrendo ao template padrão:", error?.message || error);
    // Fallback garantido
    return {
      message: buildDebtorPixChargeMessage({
        debtorName: input.debtorName,
        amountCents: input.amountCents,
        dueDate: input.dueDate,
        pixCopiaECola: input.pixCopiaECola || undefined,
        title: input.title,
        description: input.description,
        senderName: input.senderName,
      }),
      usedAI: false,
      error: error?.message || "Fallback acionado",
    };
  }
}
