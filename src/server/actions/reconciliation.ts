"use server";

import { db } from "@/server/db";
import { settleInstallment } from "@/server/actions/financial-items";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";

export interface ReconciliationScoreResult {
  score: number;
  reasons: string[];
  candidateInstallmentId?: string;
  recommendation: "MATCHED" | "SUGGESTED" | "UNMATCHED";
}

/**
 * Calcula a pontuação de conciliação entre uma movimentação importada e uma parcela prevista
 */
export async function calculateReconciliationScore(
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
): Promise<ReconciliationScoreResult> {
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
export async function categorizeTransactionDescription(description: string): Promise<string> {
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
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const unmatchedTxs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        reconciliations: {
          none: {
            status: { in: ["MATCHED", "IGNORED"] },
          },
        },
      },
    });

    const activeInstallments = await db.installment.findMany({
      where: {
        financialItem: {
          workspaceId,
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
        const result = await calculateReconciliationScore(
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
        // Executar auto-match dentro de uma transação para garantir atomicidade e prevenir Race Conditions
        await db.$transaction(async (txPrisma) => {
          // Idempotência: garantir que a transação ainda não foi reconciliada
          const currentTx = await txPrisma.externalTransaction.findUnique({
            where: { id: tx.id },
            include: { reconciliations: { where: { status: "MATCHED" } } },
          });

          if (!currentTx || currentTx.reconciliations.length > 0) return;

          // Idempotência: garantir que a parcela não está paga
          const currentInst = await txPrisma.installment.findUnique({
            where: { id: bestCandidate!.candidateInstallmentId },
            include: { financialItem: true },
          });

          if (!currentInst || currentInst.status === "SETTLED") return;

          await txPrisma.reconciliation.create({
            data: {
              workspaceId,
              externalTransactionId: tx.id,
              installmentId: bestCandidate!.candidateInstallmentId,
              status: "MATCHED",
              score: bestCandidate!.score,
              reasons: bestCandidate!.reasons,
              matchedBy: "SYSTEM",
              matchedAt: new Date(),
            },
          });

          const payAmount = BigInt(tx.amountCents);
          const newSettled = currentInst.settledAmountCents + payAmount;
          const isFullyPaid = newSettled >= currentInst.amountCents;

          await txPrisma.installment.update({
            where: { id: currentInst.id },
            data: {
              settledAmountCents: newSettled,
              status: isFullyPaid ? "SETTLED" : "PARTIAL",
              settlementDate: new Date(),
            },
          });

          await txPrisma.ledgerEntry.create({
            data: {
              workspaceId,
              externalTransactionId: tx.id,
              installmentId: currentInst.id,
              direction: tx.direction,
              amountCents: tx.amountCents,
              occurredAt: tx.occurredAt,
              sourceType: "AUTO_RECONCILIATION",
              categoryId: currentInst.financialItem.categoryId,
            },
          });
        });

        autoMatchedCount++;
      } else if (bestCandidate && bestCandidate.recommendation === "SUGGESTED" && bestCandidate.candidateInstallmentId) {
        // Registrar ou atualizar sugestão existente
        const existingSuggestion = await db.reconciliation.findFirst({
          where: {
            workspaceId,
            externalTransactionId: tx.id,
            status: "SUGGESTED",
          },
        });

        if (!existingSuggestion) {
          await db.reconciliation.create({
            data: {
              workspaceId,
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
    }

    revalidatePath("/movimentacoes");
    revalidatePath("/contas-a-pagar");
    revalidatePath("/contas-a-receber");
    revalidatePath("/relatorios");
    revalidatePath("/");
    return { success: true, autoMatchedCount };
  } catch (error: any) {
    console.error("Erro no motor de conciliação automática:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Confirmar uma sugestão de conciliação feita pelo sistema
 */
export async function confirmSuggestedMatch(reconciliationId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const rec = await db.reconciliation.findFirst({
      where: { id: reconciliationId, workspaceId },
      include: { externalTransaction: true },
    });

    if (!rec || !rec.installmentId || !rec.externalTransaction) {
      return { success: false, error: "Sugestão de conciliação não encontrada." };
    }

    await db.$transaction(async (txPrisma) => {
      // Garantir que a sugestão ainda não foi confirmada
      const currentRec = await txPrisma.reconciliation.findUnique({
        where: { id: reconciliationId },
        include: { installment: { include: { financialItem: true } } },
      });

      if (!currentRec || currentRec.status === "MATCHED") return;

      await txPrisma.reconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: "MATCHED",
          matchedBy: "USER",
          matchedAt: new Date(),
        },
      });

      if (currentRec.installment) {
        const payAmount = BigInt(rec.externalTransaction!.amountCents);
        const newSettled = currentRec.installment.settledAmountCents + payAmount;
        const isFullyPaid = newSettled >= currentRec.installment.amountCents;

        await txPrisma.installment.update({
          where: { id: currentRec.installment.id },
          data: {
            settledAmountCents: newSettled,
            status: isFullyPaid ? "SETTLED" : "PARTIAL",
            settlementDate: new Date(),
          },
        });

        await txPrisma.ledgerEntry.create({
          data: {
            workspaceId,
            externalTransactionId: rec.externalTransactionId,
            installmentId: currentRec.installmentId,
            direction: rec.externalTransaction!.direction,
            amountCents: rec.externalTransaction!.amountCents,
            occurredAt: rec.externalTransaction!.occurredAt,
            sourceType: "CONFIRMED_SUGGESTION",
            sourceId: rec.id,
            categoryId: currentRec.installment.financialItem.categoryId,
          },
        });
      }
    });

    revalidatePath("/movimentacoes");
    revalidatePath("/contas-a-pagar");
    revalidatePath("/contas-a-receber");
    revalidatePath("/relatorios");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao confirmar sugestão:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Reverter/Desconciliar uma movimentação
 */
export async function unmatchTransaction(reconciliationId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const rec = await db.reconciliation.findFirst({
      where: { id: reconciliationId, workspaceId },
      include: { installment: true },
    });

    if (!rec) {
      return { success: false, error: "Registro de conciliação não encontrado." };
    }

    await db.reconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
      },
    });

    if (rec.installmentId && rec.installment) {
      // Retornar status da parcela para SCHEDULED ou OVERDUE conforme data de vencimento
      const isOverdue = new Date() > rec.installment.dueDate;
      await db.installment.update({
        where: { id: rec.installmentId },
        data: {
          status: isOverdue ? "OVERDUE" : "SCHEDULED",
          settlementDate: null,
          settledAmountCents: 0,
        },
      });
    }

    revalidatePath("/movimentacoes");
    revalidatePath("/contas-a-pagar");
    revalidatePath("/contas-a-receber");
    revalidatePath("/relatorios");
    revalidatePath("/");

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao desconciliar transação:", error);
    return { success: false, error: error.message };
  }
}
