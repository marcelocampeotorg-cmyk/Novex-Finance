"use server";

import { z } from "zod";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { calculateAnchoredBalance } from "@/domain/financial-balance";

const adjustCashWalletSchema = z.object({
  currentRealAmountCents: z.number().int().safe().min(0),
  description: z.string().trim().min(2).max(240).optional(),
  categoryId: z.string().uuid().optional().nullable(),
});

export type AdjustCashWalletInput = z.infer<typeof adjustCashWalletSchema>;

export async function adjustCashWalletBalance(input: AdjustCashWalletInput) {
  try {
    const { workspaceId, userId } = await requireAuthenticatedWorkspace();
    const parsed = adjustCashWalletSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Dados de conferência de carteira inválidos." };
    }

    const { currentRealAmountCents, description, categoryId } = parsed.data;

    const manualAccount = await db.financialAccount.upsert({
      where: { workspaceId_type: { workspaceId, type: "MANUAL" } },
      update: { isActive: true },
      create: { workspaceId, type: "MANUAL", name: "Conta geral", openingBalanceCents: BigInt(0), openingBalanceAt: new Date(0) },
    });

    const entries = await db.ledgerEntry.findMany({
      where: {
        workspaceId,
        financialAccountId: manualAccount.id,
        occurredAt: { gte: manualAccount.openingBalanceAt || new Date(0) },
        OR: [{ externalTransaction: null }, { externalTransaction: { quarantinedAt: null } }],
      },
      select: { direction: true, amountCents: true },
    });

    const currentBalanceCents = calculateAnchoredBalance(
      Number(manualAccount.openingBalanceCents ?? 0),
      entries.map((e) => ({ direction: e.direction as "CREDIT" | "DEBIT", amountCents: Number(e.amountCents) }))
    ) ?? 0;

    const diffCents = currentRealAmountCents - currentBalanceCents;

    if (diffCents === 0) {
      return {
        success: true,
        diffCents: 0,
        newBalanceCents: currentRealAmountCents,
        message: "O saldo em mãos já está idêntico ao registrado no sistema.",
      };
    }

    const direction: "CREDIT" | "DEBIT" = diffCents > 0 ? "CREDIT" : "DEBIT";
    const amountCents = Math.abs(diffCents);

    const defaultDesc = direction === "DEBIT"
      ? (description || "Despesas diversas em espécie / Carteira física")
      : (description || "Aporte ou sobra de dinheiro em espécie");

    const fullDescription = `Conferência de Carteira (${direction === "DEBIT" ? "Saída" : "Entrada"}) — ${defaultDesc}`;

    await db.$transaction(async (tx) => {
      const externalId = `manual-wallet-adjust-${randomUUID()}`;
      const now = new Date();

      const extTx = await tx.externalTransaction.create({
        data: {
          id: randomUUID(),
          workspaceId,
          financialAccountId: manualAccount.id,
          source: "MANUAL_ADJUSTMENT",
          externalId,
          direction,
          type: "MANUAL_ENTRY",
          status: "APPROVED",
          amountCents: BigInt(amountCents),
          feeCents: BigInt(0),
          netAmountCents: BigInt(amountCents),
          occurredAt: now,
          counterpartName: "Caixa Espécie",
          description: fullDescription,
          rawEnrichmentData: {
            source: "WALLET_RECONCILIATION",
            actorUserId: userId,
            paymentMethod: "CASH",
            methodLabel: "Cédula / Dinheiro em espécie",
            previousBalanceCents: currentBalanceCents,
            adjustedBalanceCents: currentRealAmountCents,
            diffCents,
            notes: description || null,
          },
        },
      });

      await tx.ledgerEntry.create({
        data: {
          id: randomUUID(),
          workspaceId,
          financialAccountId: manualAccount.id,
          externalTransactionId: extTx.id,
          direction,
          amountCents: BigInt(amountCents),
          occurredAt: now,
          sourceType: "MANUAL_ADJUSTMENT",
          sourceId: externalId,
          categoryId: categoryId || (direction === "DEBIT" ? "e45775aa-b1a1-4a34-95a0-8d18b68fe62b" : null), // Pessoal por padrão em débito se disponível
          excludedFromReports: false,
        },
      });

      await tx.reconciliation.create({
        data: {
          id: randomUUID(),
          workspaceId,
          externalTransactionId: extTx.id,
          status: "MATCHED",
          score: 100,
          reasons: ["Conferência física de carteira realizada pelo usuário"],
          matchedBy: "USER",
          matchedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          workspaceId,
          actorType: "USER",
          actorId: userId,
          action: "WALLET_BALANCE_ADJUSTED",
          entityType: "FinancialAccount",
          entityId: manualAccount.id,
          metadata: {
            previousBalanceCents: currentBalanceCents,
            newBalanceCents: currentRealAmountCents,
            diffCents,
            direction,
            description: defaultDesc,
          },
        },
      });
    });

    revalidatePath("/");
    revalidatePath("/movimentacoes");
    revalidatePath("/relatorios");

    return {
      success: true,
      diffCents,
      direction,
      newBalanceCents: currentRealAmountCents,
    };
  } catch (error: any) {
    console.error("Erro ao ajustar saldo da carteira:", error);
    return { success: false, error: error.message || "Falha ao ajustar saldo da carteira." };
  }
}
