import "server-only";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { INTERNAL_WORKER_CONTEXT } from "@/server/internal-context";

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

  const isExactAmount = tx.amountCents === installment.amountCents;

  // 2. Referência Única ou TXID (Match Perfeito)
  if (
    (tx.txid && installment.uniqueReference && tx.txid === installment.uniqueReference) ||
    (tx.rawReference && installment.uniqueReference && tx.rawReference.includes(installment.uniqueReference))
  ) {
    score += 100;
    reasons.push("Referência única/TXID idêntico (+100)");
  }

  // 3. Valor Exato
  if (isExactAmount) {
    score += 40;
    reasons.push("Valor exato da parcela (+40)");
  } else {
    reasons.push("Divergência de valor (exige decisão)");
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

  // Regra 5: Hard Guard — Se o valor é divergente, NUNCA auto-conciliar como MATCHED
  if (!isExactAmount && score >= 100) {
    score = 75; // Teto de pontuação para divergência de valor -> exige aprovação visual
  }

  let recommendation: "MATCHED" | "SUGGESTED" | "UNMATCHED" = "UNMATCHED";
  if (score >= 100 && isExactAmount) {
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
 * Regra de categorização automática utilizando banco (CategoryRule) com fallback normalizado
 */
export async function categorizeTransactionDescription(description: string, workspaceId?: string): Promise<string> {
  const descLower = description.toLowerCase().trim();

  if (workspaceId) {
    const dbRules = await db.categoryRule.findMany({
        where: { workspaceId, isEnabled: true },
        include: { category: true },
        orderBy: { confidenceScore: "desc" },
      });

    for (const rule of dbRules) {
        if (descLower.includes(rule.pattern.toLowerCase().trim())) {
          return rule.category.name;
        }
    }
  }

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
export async function reconcileWorkspace(internalContext?: symbol, targetWorkspaceId?: string) {
  try {
    const workspaceId = internalContext === INTERNAL_WORKER_CONTEXT && targetWorkspaceId
      ? targetWorkspaceId
      : (await requireAuthenticatedWorkspace()).workspaceId;

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
        const matched = await db.$transaction(async (txPrisma) => {
          // Idempotência: garantir que a transação ainda não foi reconciliada
          const currentTx = await txPrisma.externalTransaction.findUnique({
            where: { id: tx.id },
            include: { reconciliations: { where: { status: "MATCHED" } } },
          });

          if (!currentTx || currentTx.reconciliations.length > 0) return false;

          // Idempotência: garantir que a parcela não está paga
          const currentInst = await txPrisma.installment.findUnique({
            where: { id: bestCandidate!.candidateInstallmentId },
            include: { financialItem: true },
          });

          if (!currentInst || currentInst.status === "SETTLED") return false;

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
              settlementDate: currentTx.occurredAt,
            },
          });

          // Regra 4: Conciliação NÃO cria dinheiro/LedgerEntry novo! Atualiza o LedgerEntry existente gerado na ingestão.
          await txPrisma.ledgerEntry.updateMany({
            where: {
              workspaceId,
              externalTransactionId: tx.id,
            },
            data: {
              installmentId: currentInst.id,
              categoryId: currentInst.financialItem.categoryId,
            },
          });
          return true;
        });

        if (matched) autoMatchedCount++;
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
            settlementDate: rec.externalTransaction!.occurredAt,
          },
        });

        // Regra 4: Conciliação NÃO cria dinheiro/LedgerEntry novo! Atualiza o vínculo no LedgerEntry original.
        await txPrisma.ledgerEntry.updateMany({
          where: {
            workspaceId,
            externalTransactionId: rec.externalTransactionId,
          },
          data: {
            installmentId: currentRec.installmentId,
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
 * Reverter/Desconciliar uma movimentação (Regra 6: Desconciliação atômica proporcional)
 */
export async function unmatchTransaction(reconciliationId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const rec = await db.reconciliation.findFirst({
      where: { id: reconciliationId, workspaceId },
      include: { installment: true, externalTransaction: true },
    });

    if (!rec) {
      return { success: false, error: "Registro de conciliação não encontrado." };
    }

    await db.$transaction(async (txPrisma) => {
      // 1. Marcar a reconciliação como REVERSED
      await txPrisma.reconciliation.update({
        where: { id: reconciliationId },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
        },
      });

      // 2. Desvincular parcela do LedgerEntry sem apagar a transação ou o fato financeiro
      if (rec.externalTransactionId) {
        await txPrisma.ledgerEntry.updateMany({
          where: {
            workspaceId,
            externalTransactionId: rec.externalTransactionId,
          },
          data: {
            installmentId: null,
          },
        });
      }

      // 3. Recalcular acúmulo da parcela a partir das conciliações VÁLIDAS restantes
      if (rec.installmentId) {
        const remainingMatches = await txPrisma.reconciliation.findMany({
          where: {
            installmentId: rec.installmentId,
            status: "MATCHED",
            id: { not: reconciliationId },
          },
          include: { externalTransaction: true },
        });

        let remainingSettled = BigInt(0);
        let latestOccurred: Date | null = null;

        for (const rem of remainingMatches) {
          if (rem.externalTransaction) {
            remainingSettled += rem.externalTransaction.amountCents;
            if (!latestOccurred || rem.externalTransaction.occurredAt > latestOccurred) {
              latestOccurred = rem.externalTransaction.occurredAt;
            }
          }
        }

        const inst = rec.installment!;
        const isFullyPaid = remainingSettled >= inst.amountCents;
        const isPartial = remainingSettled > BigInt(0);
        const isOverdue = new Date() > inst.dueDate;

        const newStatus = isFullyPaid ? "SETTLED" : isPartial ? "PARTIAL" : isOverdue ? "OVERDUE" : "SCHEDULED";

        await txPrisma.installment.update({
          where: { id: rec.installmentId },
          data: {
            settledAmountCents: remainingSettled,
            status: newStatus,
            settlementDate: latestOccurred,
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
    console.error("Erro ao desconciliar transação:", error);
    return { success: false, error: error.message };
  }
}
