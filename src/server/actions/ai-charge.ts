"use server";

import { generateAIPixChargeMessage, AICallbackInput, AIGenerationResult } from "@/server/services/groq-service";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

/**
 * Ação de servidor para gerar a mensagem de cobrança inteligente com IA (Groq)
 * chamada pelo modal de cobrança Pix & WhatsApp no cliente.
 */
export async function getAIPixChargeMessage(input: {
  debtorName: string;
  amountCents: number;
  dueDate: string;
  pixCopiaECola?: string;
  title?: string;
  description?: string;
  senderName?: string;
}): Promise<AIGenerationResult> {
  await requireAuthenticatedWorkspace();

  return generateAIPixChargeMessage({
    debtorName: input.debtorName,
    amountCents: input.amountCents,
    dueDate: input.dueDate,
    pixCopiaECola: input.pixCopiaECola,
    title: input.title,
    description: input.description,
    senderName: input.senderName,
  });
}
