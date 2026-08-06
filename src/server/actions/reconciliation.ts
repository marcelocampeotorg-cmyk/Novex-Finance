"use server";

import { db } from "@/server/db";
import { settleInstallment } from "@/server/actions/financial-items";
import { revalidatePath } from "next/cache";

const DEMO_WORKSPACE_ID = "ws-personal-demo";

export interface ReconciliationScoreResult {
  score: number;
  reasons: string[];
  candidateInstallmentId?: string;
  recommendation: "MATCHED" | "SUGGESTED" | "UNMATCHED";
}

/**
 * Calcula a pontuação de conciliação entre uma movimentação importada e uma parcela prevista
 */
export function calculateReconciliationScore(
  tx: {
    direction: "CREDIT" | "DEBIT";
    amountCents: number;
    occurredAt: Date;
    counterpartName?: string;
    txid?: string;
    rawReference?: string;
  },
  installment: {
    id: string;
    direction: "PAYABLE" | "RECEIVABLE";
    amountCents: number;
    dueDate: Date;
    contactName?: string;
    uniqueReference?: string;
  }
): ReconciliationScoreResult {
  const reasons: string[] = [];
  let score = 0;

  // 1. Requisito Obrigatório: Direção
  const expectedDirection = installment.direction === "PAYABLE" ? "DEBIT" : "CREDIT";
  if (tx.direction !== expectedDirection) {
    return { score: 0, reasons: ["Direção indevida"], recommendation: "UNMATCHED" };
  }

  // 2. Referência Única ou TXID (Match Perfeito)
  if (
    (tx.txid && installment.uniqueReference && tx.txid === installment.uniqueReference) ||
    (tx.rawReference && installment.uniqueReference && tx.rawReference.includes(installment.uniqueReference))
  ) {
    score += 100;
    reasons.push("Referência única/TXID idêntico (+100)");
  }

  // 3. Valor Exato
  if (tx.amountCents === installment.amountCents) {
    score += 40;
    reasons.push("Valor exato da parcela (+40)");
  }

  // 4. Contato / Favorecido Semelhante
  if (
    tx.counterpartName &&
    installment.contactName &&
    (tx.counterpartName.toLowerCase().includes(installment.contactName.toLowerCase()) ||
      installment.contactName.toLowerCase().includes(tx.counterpartName.toLowerCase()))
  ) {
    score += 25;
    reasons.push("Contato/Favorecido compatível (+25)");
  }

  // 5. Data na Mesma Janela (±3 dias do vencimento)
  const diffTime = Math.abs(tx.occurredAt.getTime() - installment.dueDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 3) {
    score += 20;
    reasons.push(`Data próxima ao vencimento (${diffDays} dia(s)) (+20)`);
  }

  let recommendation: "MATCHED" | "SUGGESTED" | "UNMATCHED" = "UNMATCHED";
  if (score >= 100) {
    recommendation = "MATCHED";
  } else if (score >= 50) {
    recommendation = "SUGGESTED";
  }

  return {
    score,
    reasons,
    candidateInstallmentId: installment.id,
    recommendation,
  };
}

/**
 * Regra de categorização automática baseada em texto da descrição
 */
export function categorizeTransactionDescription(description: string): string {
  const descLower = description.toLowerCase();

  if (descLower.includes("posto") || descLower.includes("shell") || descLower.includes("ipiranga") || descLower.includes("uber")) {
    return "Transporte & Veículo";
  }
  if (descLower.includes("drogaria") || descLower.includes("farmacia") || descLower.includes("hospital")) {
    return "Saúde & Medicamentos";
  }
  if (descLower.includes("aws") || descLower.includes("hetzner") || descLower.includes("github") || descLower.includes("google cloud")) {
    return "Serviços & Tech";
  }
  if (descLower.includes("aluguel") || descLower.includes("imobiliaria")) {
    return "Moradia";
  }
  if (descLower.includes("restaurante") || descLower.includes("ifood") || descLower.includes("padaria")) {
    return "Alimentação";
  }

  return "Não categorizada";
}

/**
 * Executar motor de conciliação automática para movimentações pendentes
 */
export async function runAutomaticReconciliationEngine() {
  try {
    const unmatchedTxs = await db.externalTransaction.findMany({
      where: {
        workspaceId: DEMO_WORKSPACE_ID,
        reconciliations: {
          none: {
            status: "MATCHED",
          },
        },
      },
    });

    const activeInstallments = await db.installment.findMany({
      where: {
        financialItem: {
          workspaceId: DEMO_WORKSPACE_ID,
          deletedAt: null,
        },
        status: { in: ["SCHEDULED", "OVERDUE", "PARTIAL"] },
      },
      include: {
        financialItem: {
          include: { contact: true },
        },
      },
    });

    let autoMatchedCount = 0;

    for (const tx of unmatchedTxs) {
      let bestCandidate: ReconciliationScoreResult | null = null;

      for (const inst of activeInstallments) {
        const result = calculateReconciliationScore(
          {
            direction: tx.direction,
            amountCents: Number(tx.amountCents),
            occurredAt: tx.occurredAt,
            counterpartName: tx.counterpartName || undefined,
            txid: tx.txid || undefined,
            rawReference: tx.rawReference || undefined,
          },
          {
            id: inst.id,
            direction: inst.financialItem.direction,
            amountCents: Number(inst.amountCents),
            dueDate: inst.dueDate,
            contactName: inst.financialItem.contact?.name || undefined,
            uniqueReference: inst.uniqueReference || undefined,
          }
        );

        if (!bestCandidate || result.score > bestCandidate.score) {
          bestCandidate = result;
        }
      }

      if (bestCandidate && bestCandidate.recommendation === "MATCHED" && bestCandidate.candidateInstallmentId) {
        // Auto-match imediato
        await db.reconciliation.create({
          data: {
            workspaceId: DEMO_WORKSPACE_ID,
            externalTransactionId: tx.id,
            installmentId: bestCandidate.candidateInstallmentId,
            status: "MATCHED",
            score: bestCandidate.score,
            reasons: bestCandidate.reasons,
            matchedBy: "SYSTEM",
            matchedAt: new Date(),
          },
        });

        await settleInstallment(bestCandidate.candidateInstallmentId, Number(tx.amountCents));
        autoMatchedCount++;
      } else if (bestCandidate && bestCandidate.recommendation === "SUGGESTED" && bestCandidate.candidateInstallmentId) {
        // Registrar sugestão
        await db.reconciliation.create({
          data: {
            workspaceId: DEMO_WORKSPACE_ID,
            externalTransactionId: tx.id,
            installmentId: bestCandidate.candidateInstallmentId,
            status: "SUGGESTED",
            score: bestCandidate.score,
            reasons: bestCandidate.reasons,
            matchedBy: "SYSTEM",
          },
        });
      }
    }

    revalidatePath("/movimentacoes");
    revalidatePath("/");
    return { success: true, autoMatchedCount };
  } catch (error: any) {
    console.error("Erro no motor de conciliação automática:", error);
    return { success: false, error: error.message };
  }
}
