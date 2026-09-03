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
    description?: string;
  },
  installment: {
    id: string;
    direction: "PAYABLE" | "RECEIVABLE";
    amountCents: number;
    dueDate: Date;
    contactName?: string;
    uniqueReference?: string;
    title?: string;
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
    score += 30;
    reasons.push("Contato/Favorecido compatível (+30)");
  }

  // 5. Título da Conta vs Descrição da Movimentação
  if (
    installment.title &&
    ((tx.description && (tx.description.toLowerCase().includes(installment.title.toLowerCase()) || installment.title.toLowerCase().includes(tx.description.toLowerCase()))) ||
      (tx.counterpartName && (tx.counterpartName.toLowerCase().includes(installment.title.toLowerCase()) || installment.title.toLowerCase().includes(tx.counterpartName.toLowerCase()))))
  ) {
    score += 25;
    reasons.push("Título/Serviço identificado no extrato (+25)");
  }

  // 6. Data na Mesma Janela (±3 dias do vencimento)
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
  if (score >= 90 && isExactAmount) {
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
 * Regra de categorização automática utilizando banco (CategoryRule) com fallback normalizado inteligente
 */
export async function categorizeTransactionDescription(description: string, workspaceId?: string): Promise<string> {
  const descLower = (description || "").toLowerCase().trim();

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

  // 1. Assinaturas & Lazer (Streaming & Entretenimento)
  if (
    descLower.includes("youtube") ||
    descLower.includes("youtubepremium") ||
    descLower.includes("netflix") ||
    descLower.includes("spotify") ||
    descLower.includes("prime") ||
    descLower.includes("disney") ||
    descLower.includes("hbo") ||
    descLower.includes("max") ||
    descLower.includes("star+") ||
    descLower.includes("deezer") ||
    descLower.includes("apple") ||
    descLower.includes("globoplay") ||
    descLower.includes("paramount") ||
    descLower.includes("crunchyroll") ||
    descLower.includes("twitch") ||
    descLower.includes("streaming")
  ) {
    return "Assinaturas & Lazer";
  }

  // 2. Telecom & Internet (Celular, Telefonia e Banda Larga)
  if (
    descLower.includes("claro") ||
    descLower.includes("vivo") ||
    descLower.includes("tim") ||
    descLower.includes("oi") ||
    descLower.includes("algar") ||
    descLower.includes("net virtua") ||
    descLower.includes("starlink") ||
    descLower.includes("embratel") ||
    descLower.includes("telefonia") ||
    descLower.includes("fatura celular")
  ) {
    return "Telecom & Internet";
  }

  // 3. Serviços & Softwares (Cloud, IA, Hospedagem e Ferramentas)
  if (
    descLower.includes("google one") ||
    descLower.includes("google") ||
    descLower.includes("aws") ||
    descLower.includes("hetzner") ||
    descLower.includes("vultr") ||
    descLower.includes("digitalocean") ||
    descLower.includes("cloudflare") ||
    descLower.includes("github") ||
    descLower.includes("openai") ||
    descLower.includes("claude") ||
    descLower.includes("anthropic") ||
    descLower.includes("cursor") ||
    descLower.includes("vercel") ||
    descLower.includes("hostinger") ||
    descLower.includes("godaddy") ||
    descLower.includes("adobe") ||
    descLower.includes("canva") ||
    descLower.includes("notion") ||
    descLower.includes("slack") ||
    descLower.includes("zoom") ||
    descLower.includes("software") ||
    descLower.includes("hospedagem")
  ) {
    return "Serviços & Softwares";
  }

  // 4. Empréstimos & Crédito
  if (
    descLower.includes("mercado crédito") ||
    descLower.includes("mercado credito") ||
    descLower.includes("emprestimo") ||
    descLower.includes("empréstimo") ||
    descLower.includes("financiamento") ||
    descLower.includes("fatura cartão") ||
    descLower.includes("parcela de mercado")
  ) {
    return "Empréstimos & Crédito";
  }

  // 5. Compras & E-commerce
  if (
    descLower.includes("mercado livre") ||
    descLower.includes("mercadolivre") ||
    descLower.includes("amazon") ||
    descLower.includes("shopee") ||
    descLower.includes("aliexpress") ||
    descLower.includes("shein") ||
    descLower.includes("magalu") ||
    descLower.includes("magazine luiza") ||
    descLower.includes("relogio") ||
    descLower.includes("relógio") ||
    descLower.includes("compra")
  ) {
    return "Compras & E-commerce";
  }

  // 6. Transporte & Mobilidade
  if (
    descLower.includes("posto") ||
    descLower.includes("shell") ||
    descLower.includes("ipiranga") ||
    descLower.includes("petrobras") ||
    descLower.includes("uber") ||
    descLower.includes("99app") ||
    descLower.includes("99 pop") ||
    descLower.includes("99 taxi") ||
    descLower.includes("indrive") ||
    descLower.includes("combustivel") ||
    descLower.includes("combustível") ||
    descLower.includes("sem parar") ||
    descLower.includes("veloe") ||
    descLower.includes("conectcar") ||
    descLower.includes("estacionamento")
  ) {
    return "Transporte & Mobilidade";
  }

  // 7. Alimentação & Mercado
  if (
    descLower.includes("restaurante") ||
    descLower.includes("ifood") ||
    descLower.includes("rappi") ||
    descLower.includes("ze delivery") ||
    descLower.includes("zé delivery") ||
    descLower.includes("mcdonald") ||
    descLower.includes("burger king") ||
    descLower.includes("subway") ||
    descLower.includes("padaria") ||
    descLower.includes("mercado") ||
    descLower.includes("supermercado") ||
    descLower.includes("carrefour") ||
    descLower.includes("pao de acucar") ||
    descLower.includes("pão de açúcar") ||
    descLower.includes("assai") ||
    descLower.includes("assaí") ||
    descLower.includes("atacadao") ||
    descLower.includes("atacadão") ||
    descLower.includes("delivery")
  ) {
    return "Alimentação & Mercado";
  }

  // 8. Saúde & Farmácia
  if (
    descLower.includes("drogaria") ||
    descLower.includes("farmacia") ||
    descLower.includes("farmácia") ||
    descLower.includes("drogasil") ||
    descLower.includes("droga raia") ||
    descLower.includes("pacheco") ||
    descLower.includes("panvel") ||
    descLower.includes("pague menos") ||
    descLower.includes("hospital") ||
    descLower.includes("consulta") ||
    descLower.includes("laboratorio") ||
    descLower.includes("laboratório") ||
    descLower.includes("unimed")
  ) {
    return "Saúde & Farmácia";
  }

  // 9. Moradia & Utilidades (Água, Luz, Aluguel, Condomínio)
  if (
    descLower.includes("enel") ||
    descLower.includes("sabesp") ||
    descLower.includes("copel") ||
    descLower.includes("cemig") ||
    descLower.includes("cpfl") ||
    descLower.includes("energia") ||
    descLower.includes("luz") ||
    descLower.includes("agua") ||
    descLower.includes("água") ||
    descLower.includes("saneamento") ||
    descLower.includes("aluguel") ||
    descLower.includes("imobiliaria") ||
    descLower.includes("imobiliária") ||
    descLower.includes("iptu") ||
    descLower.includes("condominio") ||
    descLower.includes("condomínio")
  ) {
    return "Moradia & Utilidades";
  }

  // 10. Receitas Operacionais & Assinaturas Novex
  if (
    descLower.includes("assinatura novex") ||
    descLower.includes("totem") ||
    descLower.includes("deposito totem") ||
    descLower.includes("sistema de atendimento") ||
    descLower.includes("mensalidade")
  ) {
    return "Receitas Operacionais";
  }

  // 11. Rendimentos & Tarifas do Provedor
  if (
    descLower.includes("settlement") ||
    descLower.includes("rendimento") ||
    descLower.includes("tarifa") ||
    descLower.includes("iof") ||
    descLower.includes("taxa")
  ) {
    return "Rendimentos & Tarifas MP";
  }

  // 12. Transferências, Bancos & Carteiras Digitais
  if (
    descLower.includes("99pay") ||
    descLower.includes("picpay") ||
    descLower.includes("c6") ||
    descLower.includes("santander") ||
    descLower.includes("nu pagamentos") ||
    descLower.includes("nubank") ||
    descLower.includes("inter") ||
    descLower.includes("pagseguro") ||
    descLower.includes("itau") ||
    descLower.includes("itaú") ||
    descLower.includes("bradesco") ||
    descLower.includes("banco do brasil") ||
    descLower.includes("caixa") ||
    descLower.includes("bancoob") ||
    descLower.includes("asaas") ||
    descLower.includes("mercado pago") ||
    descLower.includes("mercadopago") ||
    descLower.includes("pix")
  ) {
    return "Transferências & Carteiras";
  }

  return "Outros";
}

/**
 * Executar motor de conciliação automática para movimentações pendentes
 */
export async function reconcileWorkspace(internalContext?: symbol | string, targetWorkspaceId?: string) {
  try {
    const workspaceId = typeof internalContext === "string"
      ? internalContext
      : (internalContext === INTERNAL_WORKER_CONTEXT && targetWorkspaceId
        ? targetWorkspaceId
        : (await requireAuthenticatedWorkspace()).workspaceId);

    const unmatchedTxs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        quarantinedAt: null,
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
            description: tx.description || undefined,
          },
          {
            id: inst.id,
            direction: inst.financialItem.direction,
            amountCents: Number(inst.amountCents),
            dueDate: inst.dueDate,
            contactName: inst.financialItem.contact?.name || undefined,
            uniqueReference: inst.uniqueReference || undefined,
            title: inst.financialItem.title || undefined,
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

/**
 * Mapeamento inicial de termos populares brasileiros para semente de regras inteligentes
 */
const DEFAULT_BRAZILIAN_PATTERNS: { categoryTarget: string; patterns: string[] }[] = [
  {
    categoryTarget: "Alimentação & Mercado",
    patterns: [
      "ifood", "rappi", "mcdonald", "burger king", "habibs", "subway", "padaria", "restaurante",
      "pizzaria", "lanchonete", "churrascaria", "carrefour", "pao de acucar", "assai", "atacadao",
      "extra", "dia", "supermercado", "mercado", "hortifruti", "acougue", "sams club", "doceria", "sorveteria"
    ]
  },
  {
    categoryTarget: "Transporte & Mobilidade",
    patterns: [
      "uber", "99app", "99pop", "taxi", "estacionamento", "pedagio", "sem parar", "veloe",
      "conectcar", "moovit", "metro", "autopass", "posto", "shell", "ipiranga", "petrobras",
      "br distribuidora", "ale", "gasolina", "combustivel", "abastecimento", "estapar"
    ]
  },
  {
    categoryTarget: "Saúde & Farmácia",
    patterns: [
      "droga raia", "drogasil", "pacheco", "pague menos", "panvel", "farmacia", "drogaria",
      "laboratorio", "hospital", "clinica", "unimed", "dentista", "otica", "consulta medica"
    ]
  },
  {
    categoryTarget: "Assinaturas & Lazer",
    patterns: [
      "netflix", "spotify", "youtube", "prime video", "disney", "max", "deezer", "apple",
      "globo", "twitch", "crunchyroll", "cinema", "ingresso", "sympla", "eventim"
    ]
  },
  {
    categoryTarget: "Telecom & Internet",
    patterns: [
      "claro", "vivo", "tim", "oi", "net virtua", "starlink", "algar", "telefonia", "internet"
    ]
  },
  {
    categoryTarget: "Serviços & Softwares",
    patterns: [
      "google", "aws", "digitalocean", "github", "chatgpt", "openai", "anthropic", "cursor",
      "canva", "adobe", "microsoft", "hostinger", "godaddy", "vercel", "slack", "zoom", "notion"
    ]
  },
  {
    categoryTarget: "Compras & E-commerce",
    patterns: [
      "mercado livre", "shopee", "amazon", "shein", "aliexpress", "magalu", "magazine luiza",
      "casas bahia", "americanas", "zara", "renner", "riachuelo", "centauro", "netshoes", "relogio"
    ]
  },
  {
    categoryTarget: "Moradia & Utilidades",
    patterns: [
      "enel", "sabesp", "copel", "cemig", "cpfl", "luz", "agua", "energia", "aluguel",
      "imobiliaria", "condominio", "iptu", "comgas"
    ]
  },
  {
    categoryTarget: "Rendimentos & Tarifas MP",
    patterns: [
      "settlement", "rendimento", "tarifa", "iof", "taxa", "tarifa bancaria"
    ]
  },
  {
    categoryTarget: "Transferências & Carteiras",
    patterns: [
      "payouts", "saque", "retirada", "99pay", "picpay", "c6", "santander", "nu pagamentos",
      "nubank", "inter", "pagseguro", "itau", "bradesco", "banco do brasil", "caixa", "bancoob", "asaas"
    ]
  }
];

/**
 * Semear regras iniciais no banco de dados para um workspace
 */
export async function seedWorkspaceCategoryRules(workspaceId: string) {
  const categories = await db.category.findMany({
    where: { workspaceId },
  });

  if (categories.length === 0) return { seededCount: 0 };

  let seededCount = 0;

  for (const group of DEFAULT_BRAZILIAN_PATTERNS) {
    // Encontrar a categoria correspondente mais próxima
    const matchedCategory = categories.find((c) =>
      c.name.toLowerCase().includes(group.categoryTarget.toLowerCase()) ||
      group.categoryTarget.toLowerCase().includes(c.name.toLowerCase())
    );

    if (!matchedCategory) continue;

    for (const pattern of group.patterns) {
      try {
        await db.categoryRule.upsert({
          where: {
            workspaceId_pattern: {
              workspaceId,
              pattern: pattern.toLowerCase().trim(),
            },
          },
          update: {
            categoryId: matchedCategory.id,
            confidenceScore: 90,
            isEnabled: true,
          },
          create: {
            workspaceId,
            pattern: pattern.toLowerCase().trim(),
            categoryId: matchedCategory.id,
            confidenceScore: 90,
            source: "SYSTEM",
            isEnabled: true,
          },
        });
        seededCount++;
      } catch (e) {
        // Ignora duplicidades silenciosamente
      }
    }
  }

  return { seededCount };
}

/**
 * Aprender uma nova regra a partir da ação do usuário e aplicar retroativamente
 */
export async function learnCategoryRule(params: {
  workspaceId: string;
  pattern: string;
  categoryId: string;
  applyToPast?: boolean;
}) {
  const { workspaceId, categoryId, applyToPast = true } = params;
  const cleanPattern = params.pattern.toLowerCase().trim();

  if (!cleanPattern || cleanPattern.length < 2) {
    throw new Error("Padrão de reconhecimento inválido (mínimo de 2 caracteres).");
  }

  // 1. Gravar a regra no banco de dados com pontuação máxima
  const rule = await db.categoryRule.upsert({
    where: {
      workspaceId_pattern: {
        workspaceId,
        pattern: cleanPattern,
      },
    },
    update: {
      categoryId,
      confidenceScore: 95,
      isEnabled: true,
      source: "USER",
    },
    create: {
      workspaceId,
      pattern: cleanPattern,
      categoryId,
      confidenceScore: 95,
      source: "USER",
      isEnabled: true,
    },
    include: { category: true },
  });

  let updatedPastCount = 0;

  // 2. Se applyToPast estiver ativo, atualizar retroativamente todas as transações que contenham esse texto
  if (applyToPast) {
    const matchingTxs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        OR: [
          { description: { contains: cleanPattern, mode: "insensitive" } },
          { counterpartName: { contains: cleanPattern, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (matchingTxs.length > 0) {
      const txIds = matchingTxs.map((t) => t.id);
      const res = await db.ledgerEntry.updateMany({
        where: {
          workspaceId,
          externalTransactionId: { in: txIds },
        },
        data: {
          categoryId,
        },
      });
      updatedPastCount = res.count;
    }
  }

  revalidatePath("/movimentacoes");
  revalidatePath("/relatorios");
  revalidatePath("/");

  return {
    success: true,
    ruleId: rule.id,
    pattern: rule.pattern,
    categoryName: rule.category.name,
    updatedPastCount,
  };
}

/**
 * Atualizar a categoria de uma transação específica e opcionalmente criar regra de aprendizado
 */
export async function updateTransactionCategory(params: {
  workspaceId: string;
  transactionId: string;
  categoryId: string;
  learnPattern?: string;
}) {
  const { workspaceId, transactionId, categoryId, learnPattern } = params;

  // 1. Atualizar o LedgerEntry da transação
  await db.ledgerEntry.updateMany({
    where: {
      workspaceId,
      externalTransactionId: transactionId,
    },
    data: {
      categoryId,
    },
  });

  // 2. Se foi informado um padrão para aprender, salva no banco e aplica às demais
  let learnedRuleResult = null;
  if (learnPattern && learnPattern.trim().length >= 2) {
    learnedRuleResult = await learnCategoryRule({
      workspaceId,
      pattern: learnPattern,
      categoryId,
      applyToPast: true,
    });
  }

  revalidatePath("/movimentacoes");
  revalidatePath("/relatorios");
  revalidatePath("/");

  return {
    success: true,
    learnedRule: learnedRuleResult,
  };
}

/**
 * Executar varredura completa de Auto-Categorização e Auto-Conciliação
 */
export async function runFullCategorizationAndReconciliation(workspaceId: string) {
  // 1. Garantir que o workspace tenha as regras semeadas
  const existingRulesCount = await db.categoryRule.count({ where: { workspaceId } });
  if (existingRulesCount < 10) {
    await seedWorkspaceCategoryRules(workspaceId);
  }

  // 2. Buscar todas as regras ativas ordenadas por score
  const rules = await db.categoryRule.findMany({
    where: { workspaceId, isEnabled: true },
    orderBy: { confidenceScore: "desc" },
  });

  // 2.5. Enriquecer transações pendentes de dados de contraparte
  try {
    const { enrichAllMercadoPagoTransactions } = await import("@/server/services/transactions-service");
    await enrichAllMercadoPagoTransactions(INTERNAL_WORKER_CONTEXT, workspaceId);
  } catch (enrichErr: any) {
    console.warn("[runFullCategorizationAndReconciliation] Aviso ao enriquecer transações:", enrichErr.message);
  }

  // 3. Buscar transações externas e verificar seus ledgerEntries
  const txs = await db.externalTransaction.findMany({
    where: { workspaceId, quarantinedAt: null },
    include: { ledgerEntries: true },
  });

  let categorizedCount = 0;

  for (const tx of txs) {
    const textToMatch = `${tx.description || ""} ${tx.counterpartName || ""}`.toLowerCase();
    const matchedRule = rules.find((r) => textToMatch.includes(r.pattern.toLowerCase().trim()));

    if (matchedRule) {
      for (const entry of tx.ledgerEntries) {
        if (!entry.categoryId || entry.categoryId !== matchedRule.categoryId) {
          await db.ledgerEntry.update({
            where: { id: entry.id },
            data: { categoryId: matchedRule.categoryId },
          });
          categorizedCount++;
        }
      }
    }
  }

  // 4. Executar o motor de auto-conciliação
  const reconResult = await reconcileWorkspace(workspaceId);

  revalidatePath("/movimentacoes");
  revalidatePath("/contas-a-pagar");
  revalidatePath("/contas-a-receber");
  revalidatePath("/relatorios");
  revalidatePath("/");

  return {
    success: true,
    categorizedCount,
    autoMatchedCount: reconResult.autoMatchedCount,
  };
}

/**
 * Listar categorias disponíveis no workspace
 */
export async function getWorkspaceCategories(workspaceId: string) {
  return db.category.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      colorToken: true,
      icon: true,
      direction: true,
    },
  });
}
