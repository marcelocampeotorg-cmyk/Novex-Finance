import "server-only";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { INTERNAL_WORKER_CONTEXT } from "@/server/internal-context";
import { classifyTransactionDescription, extractCounterpartPattern } from "@/domain/transaction-classification";
import { toTitleCaseCounterpart } from "@/domain/mercado-pago-account-statement";

/**
 * Aplica memória viva de regras de contrapartes ativas a transações pendentes
 */
export async function applyCounterpartMemoryToTransactions(targetWorkspaceId?: string, internalContext?: symbol) {
  try {
    const workspaceId = internalContext === INTERNAL_WORKER_CONTEXT && targetWorkspaceId
      ? targetWorkspaceId
      : (await requireAuthenticatedWorkspace()).workspaceId;

    const rules = await db.counterpartRule.findMany({
      where: { workspaceId, isEnabled: true },
      select: { pattern: true, canonicalName: true, defaultCategoryId: true, confidenceScore: true, source: true, isEnabled: true },
    });
    if (rules.length === 0) return { success: true, updatedCount: 0 };

    const eligibleTxs = await db.externalTransaction.findMany({
      where: {
        workspaceId,
        quarantinedAt: null,
        counterpartName: null,
      },
      select: {
        id: true,
        description: true,
        rawProviderData: true,
        rawEnrichmentData: true,
      },
      take: 100,
    });

    let updatedCount = 0;
    for (const tx of eligibleTxs) {
      const raw = typeof tx.rawProviderData === "object" && tx.rawProviderData !== null
        ? (tx.rawProviderData as Record<string, unknown>)
        : {};
      const evidence = [
        tx.description,
        raw?.DESCRIPTION,
        raw?.SALE_DETAIL,
        raw?.OPERATION_TAGS,
        raw?.EXTERNAL_REFERENCE,
      ].filter((v): v is string => typeof v === "string").join(" ");

      const classification = classifyTransactionDescription(evidence, null, rules);
      if (classification.merchantName && (classification.confidence === "HIGH" || classification.confidence === "MEDIUM")) {
        const enrichment = typeof tx.rawEnrichmentData === "object" && tx.rawEnrichmentData !== null
          ? (tx.rawEnrichmentData as Record<string, unknown>)
          : {};

        await db.externalTransaction.update({
          where: { id: tx.id },
          data: {
            counterpartName: classification.merchantName,
            rawEnrichmentData: {
              ...enrichment,
              source: "INFERRED",
              counterpartRule: {
                pattern: classification.matchedPattern,
                canonicalName: classification.merchantName,
                confidence: classification.confidence,
                reason: classification.reason,
                appliedAt: new Date().toISOString(),
              },
            } as any,
          },
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      revalidatePath("/movimentacoes");
      revalidatePath("/relatorios");
      revalidatePath("/");
    }

    return { success: true, updatedCount };
  } catch (err: any) {
    console.error("Erro ao aplicar memória de fornecedores:", err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Confirma ou edita a identidade de um favorecido e opcionalmente gera regra de memória futura
 */
export async function confirmTransactionCounterpart(params: {
  externalTransactionId: string;
  counterpartName: string;
  rememberRule?: boolean;
}) {
  try {
    const { workspaceId, userId } = await requireAuthenticatedWorkspace();
    const cleanName = toTitleCaseCounterpart(params.counterpartName);
    if (!cleanName || cleanName.length < 2) {
      return { success: false, error: "Nome do favorecido inválido (mínimo de 2 caracteres)." };
    }

    const tx = await db.externalTransaction.findFirst({
      where: { id: params.externalTransactionId, workspaceId },
    });
    if (!tx) {
      return { success: false, error: "Movimentação não encontrada." };
    }

    const enrichment = typeof tx.rawEnrichmentData === "object" && tx.rawEnrichmentData !== null
      ? (tx.rawEnrichmentData as Record<string, unknown>)
      : {};

    await db.$transaction(async (prismaTx) => {
      await prismaTx.externalTransaction.update({
        where: { id: tx.id },
        data: {
          counterpartName: cleanName,
          rawEnrichmentData: {
            ...enrichment,
            source: "USER_CONFIRMED",
            userConfirmation: {
              confirmedAt: new Date().toISOString(),
              confirmedBy: userId,
              counterpartName: cleanName,
            },
          } as any,
        },
      });

      if (params.rememberRule) {
        const pattern = extractCounterpartPattern(cleanName);
        if (pattern && pattern.length >= 2) {
          await prismaTx.counterpartRule.upsert({
            where: {
              workspaceId_pattern: { workspaceId, pattern },
            },
            update: {
              canonicalName: cleanName,
              confidenceScore: 95,
              source: "USER_CONFIRMED",
              isEnabled: true,
            },
            create: {
              workspaceId,
              pattern,
              canonicalName: cleanName,
              confidenceScore: 95,
              source: "USER_CONFIRMED",
              isEnabled: true,
            },
          });
        }
      }

      await prismaTx.auditLog.create({
        data: {
          workspaceId,
          actorType: "USER",
          actorId: userId,
          action: "COUNTERPART_NAME_CONFIRMED",
          entityType: "ExternalTransaction",
          entityId: tx.id,
          metadata: {
            counterpartName: cleanName,
            rememberRule: Boolean(params.rememberRule),
          },
        },
      });
    });

    if (params.rememberRule) {
      await applyCounterpartMemoryToTransactions(workspaceId);
    }

    revalidatePath("/movimentacoes");
    return { success: true, counterpartName: cleanName };
  } catch (err: any) {
    console.error("Erro ao confirmar favorecido:", err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Consulta regras de contrapartes ativas do workspace
 */
export async function getCounterpartRules() {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    const rules = await db.counterpartRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, rules };
  } catch (err: any) {
    return { success: false, error: err.message || String(err), rules: [] };
  }
}

/**
 * Ativa ou desativa uma regra de contraparte
 */
export async function toggleCounterpartRule(id: string, isEnabled: boolean) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    await db.counterpartRule.updateMany({
      where: { id, workspaceId },
      data: { isEnabled },
    });
    revalidatePath("/movimentacoes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Remove uma regra de contraparte
 */
export async function deleteCounterpartRule(id: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();
    await db.counterpartRule.deleteMany({
      where: { id, workspaceId },
    });
    revalidatePath("/movimentacoes");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}
