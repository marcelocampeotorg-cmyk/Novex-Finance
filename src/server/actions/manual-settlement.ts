"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { z } from "zod";
import crypto from "crypto";

const manualSettlementSchema = z.object({
  installmentId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  settlementDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Data de liquidação inválida.",
  }),
  paymentMethod: z.enum(["CASH", "PIX_MANUAL", "BANK_TRANSFER", "OTHER"]),
  notes: z.string().max(500).optional(),
});

export type ManualSettlementInput = z.infer<typeof manualSettlementSchema>;

export async function settleInstallmentManually(input: ManualSettlementInput) {
  try {
    const { workspaceId, userId } = await requireAuthenticatedWorkspace();

    const parsed = manualSettlementSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Dados de liquidação inválidos." };
    }

    const { installmentId, amountCents, settlementDate, paymentMethod, notes } = parsed.data;
    const settlementDateObj = new Date(settlementDate);

    return await db.$transaction(async (tx) => {
      // 1. Localizar parcela com item financeiro e relações
      const installment = await tx.installment.findFirst({
        where: {
          id: installmentId,
          financialItem: { workspaceId, deletedAt: null },
        },
        include: {
          financialItem: {
            include: { contact: true, category: true },
          },
        },
      });

      if (!installment) {
        return { success: false, error: "Parcela não encontrada ou permissão insuficiente." };
      }

      if (installment.status === "SETTLED") {
        return { success: false, error: "Esta parcela já se encontra totalmente quitada." };
      }

      const totalAmt = Number(installment.amountCents);
      const currentSettled = Number(installment.settledAmountCents);
      const remainingCents = totalAmt - currentSettled;

      if (amountCents > remainingCents) {
        return {
          success: false,
          error: `Valor informado (R$ ${(amountCents / 100).toFixed(2)}) é maior que o saldo restante da parcela (R$ ${(remainingCents / 100).toFixed(2)}).`,
        };
      }

      // 2. Localizar ou inicializar a Conta Geral Manual
      let manualAccount = await tx.financialAccount.findUnique({
        where: { workspaceId_type: { workspaceId, type: "MANUAL" } },
      });

      if (!manualAccount) {
        manualAccount = await tx.financialAccount.create({
          data: {
            workspaceId,
            type: "MANUAL",
            name: "Conta geral",
            isActive: true,
            openingBalanceCents: 0n,
            openingBalanceAt: new Date(0),
          },
        });
      } else if (manualAccount.openingBalanceCents === null || !manualAccount.openingBalanceAt) {
        manualAccount = await tx.financialAccount.update({
          where: { id: manualAccount.id },
          data: {
            openingBalanceCents: manualAccount.openingBalanceCents ?? 0n,
            openingBalanceAt: manualAccount.openingBalanceAt ?? new Date(0),
          },
        });
      }

      const isReceivable = installment.financialItem.direction === "RECEIVABLE";
      const txDirection: "CREDIT" | "DEBIT" = isReceivable ? "CREDIT" : "DEBIT";

      const methodLabelMap: Record<string, string> = {
        CASH: "Cédula / Dinheiro em espécie",
        PIX_MANUAL: "Pix (manual / externo)",
        BANK_TRANSFER: "Transferência Bancária",
        OTHER: "Outro meio manual",
      };
      const methodLabel = methodLabelMap[paymentMethod] || "Manual";

      const descPrefix = isReceivable ? "Recebimento" : "Pagamento";
      const description = `${descPrefix} em ${methodLabel} — ${installment.financialItem.title}`;

      // 3. Criar a ExternalTransaction (fato manual auditável)
      const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const extTx = await tx.externalTransaction.create({
        data: {
          workspaceId,
          financialAccountId: manualAccount.id,
          source: "MANUAL_ADJUSTMENT",
          provider: null,
          externalId: `manual-settle-${suffix}`,
          direction: txDirection,
          type: "MANUAL_ENTRY",
          status: "APPROVED",
          amountCents: BigInt(amountCents),
          netAmountCents: BigInt(amountCents),
          occurredAt: settlementDateObj,
          counterpartName: installment.financialItem.contact?.name || undefined,
          description,
          rawEnrichmentData: {
            source: "MANUAL_SETTLEMENT",
            paymentMethod,
            methodLabel,
            notes: notes || undefined,
            actorUserId: userId,
            installmentId: installment.id,
            financialItemId: installment.financialItemId,
          },
        },
      });

      // 4. Criar o LedgerEntry atômico
      await tx.ledgerEntry.create({
        data: {
          workspaceId,
          financialAccountId: manualAccount.id,
          externalTransactionId: extTx.id,
          installmentId: installment.id,
          categoryId: installment.financialItem.categoryId,
          direction: txDirection,
          amountCents: BigInt(amountCents),
          occurredAt: settlementDateObj,
          sourceType: "MANUAL_ADJUSTMENT",
          sourceId: extTx.externalId,
        },
      });

      // 5. Criar Reconciliation com status MATCHED
      await tx.reconciliation.create({
        data: {
          workspaceId,
          externalTransactionId: extTx.id,
          installmentId: installment.id,
          financialItemId: installment.financialItemId,
          status: "MATCHED",
          score: 100,
          matchedBy: "USER",
          matchedAt: new Date(),
          reasons: [`Baixa manual confirmada pelo usuário (${methodLabel})`],
        },
      });

      // 6. Atualizar a Parcela
      const newSettledAmount = installment.settledAmountCents + BigInt(amountCents);
      const isFullySettled = newSettledAmount >= installment.amountCents;
      const newStatus = isFullySettled ? "SETTLED" : "PARTIAL";

      await tx.installment.update({
        where: { id: installment.id },
        data: {
          settledAmountCents: newSettledAmount,
          status: newStatus,
          settlementDate: settlementDateObj,
        },
      });

      // 7. Se todas as parcelas do item estiverem quitadas, atualizar status do item pai
      const allItemInsts = await tx.installment.findMany({
        where: { financialItemId: installment.financialItemId },
      });
      const allSettled = allItemInsts.every((inst) =>
        inst.id === installment.id ? isFullySettled : inst.status === "SETTLED"
      );

      if (allSettled) {
        await tx.financialItem.update({
          where: { id: installment.financialItemId },
          data: { status: "COMPLETED" },
        });
      }

      // 8. Trilha de Auditoria
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorType: "USER",
          actorId: userId,
          action: "INSTALLMENT_MANUAL_SETTLED",
          entityType: "Installment",
          entityId: installment.id,
          metadata: {
            financialItemId: installment.financialItemId,
            amountCents,
            settlementDate,
            paymentMethod,
            methodLabel,
            notes,
            externalTransactionId: extTx.id,
            newStatus,
          },
        },
      });

      revalidatePath("/");
      revalidatePath("/contas-a-receber");
      revalidatePath("/contas-a-pagar");
      revalidatePath("/movimentacoes");
      revalidatePath("/relatorios");

      return {
        success: true,
        newStatus,
        newSettledAmountCents: Number(newSettledAmount),
        isFullySettled,
      };
    });
  } catch (error: any) {
    console.error("Erro ao registrar baixa manual:", error);
    return { success: false, error: error.message || "Falha ao registrar quitação manual." };
  }
}
