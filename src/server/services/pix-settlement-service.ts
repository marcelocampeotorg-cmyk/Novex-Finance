import { db } from "../db.ts";

export interface SettlePixChargeInput {
  pixChargeId: string;
  paidAt: Date;
  actorType?: "SYSTEM" | "USER" | "WEBHOOK";
  actorId?: string;
  externalOrderId?: string;
  paidAmountCents?: number;
}

/**
 * Baixa atômica unificada de PixCharge com Claim Exclusivo.
 * Carrega e valida a própria PixCharge pelo ID, derivando workspaceId, installmentId e amount.
 * Garante que apenas um processo concorrente (Webhook ou Polling) transite status != 'PAID' -> 'PAID'
 * e altere a parcela/auditoria correspondente sem risco de incompatibilidade de parâmetros.
 */
export async function settlePixChargeAtomic(input: SettlePixChargeInput) {
  return await db.$transaction(async (tx) => {
    // 1. Carregar a PixCharge com sua parcela e workspace vinculados
    const pixCharge = await tx.pixCharge.findUnique({
      where: { id: input.pixChargeId },
      include: { installment: true },
    });

    if (!pixCharge) {
      return { success: false, claimed: false, error: "PixCharge não encontrada no sistema." };
    }

    const workspaceId = pixCharge.workspaceId;
    const installmentId = pixCharge.installmentId;
    const expectedAmt = Number(pixCharge.amountCents);
    const paidAmt = input.paidAmountCents !== undefined && input.paidAmountCents !== null ? input.paidAmountCents : expectedAmt;
    if (Number.isNaN(input.paidAt.getTime())) {
      return { success: false, claimed: false, error: "Timestamp oficial de pagamento inválido." };
    }
    const paidAtDate = input.paidAt;

    // Regra Canônica 17.3: QR tem valor fixo. Se o valor oficial for divergente, não aplica baixa automática
    if (paidAmt !== expectedAmt) {
      await tx.pixCharge.update({
        where: { id: pixCharge.id },
        data: {
          status: "ACTION_REQUIRED",
          statusDetail: `PAGAMENTO_DIVERGENTE: Recebido R$ ${(paidAmt/100).toFixed(2)}, esperado R$ ${(expectedAmt/100).toFixed(2)}. Parcela mantida sem baixa automática para decisão do usuário.`,
          paidAt: paidAtDate,
          lastCheckedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId,
          actorType: input.actorType || "SYSTEM",
          actorId: input.actorId || "SYSTEM",
          action: "MP_PIX_CHARGE_DIVERGENT_PAYMENT",
          entityType: "PixCharge",
          entityId: pixCharge.id,
          metadata: {
            externalOrderId: input.externalOrderId || pixCharge.externalOrderId,
            expectedAmountCents: expectedAmt,
            receivedAmountCents: paidAmt,
            installmentId,
          },
        },
      });

      return { success: true, claimed: true, divergent: true, expectedAmt, paidAmt };
    }

    // 2. Claim atômico condicional: apenas se status for diferente de PAID
    const claimResult = await tx.pixCharge.updateMany({
      where: { id: pixCharge.id, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: paidAtDate, lastCheckedAt: new Date() },
    });

    // Se count === 0, outro processo ganhou a corrida — retorno idempotente sem alterar parcela
    if (claimResult.count === 0) {
      return { success: true, claimed: false, alreadyPaid: true };
    }

    // 3. Incrementar parcela no processo vencedor do claim usando as relações derivadas
    const currentInstallment = pixCharge.installment;

    // Regra Canônica 17.4: Pagamento duplicado em parcela já quitada gera alerta e não altera dívida
    if (!currentInstallment || currentInstallment.status === "SETTLED") {
      await tx.auditLog.create({
        data: {
          workspaceId,
          actorType: input.actorType || "SYSTEM",
          actorId: input.actorId || "SYSTEM",
          action: "MP_PIX_CHARGE_DUPLICATE_PAYMENT_ALERT",
          entityType: "PixCharge",
          entityId: pixCharge.id,
          metadata: {
            externalOrderId: input.externalOrderId || pixCharge.externalOrderId,
            amountCents: expectedAmt,
            installmentId,
            reason: "Parcela já se encontrava quitada.",
          },
        },
      });
      return { success: true, claimed: true, duplicatePayment: true, installmentAlreadySettled: true };
    }

    const currentSettled = Number(currentInstallment.settledAmountCents);
    const totalAmount = Number(currentInstallment.amountCents);
    const newSettled = currentSettled + expectedAmt;
    const newStatus = newSettled >= totalAmount ? "SETTLED" : "PARTIAL";

    await tx.installment.update({
      where: { id: installmentId },
      data: {
        settledAmountCents: BigInt(newSettled),
        status: newStatus,
        settlementDate: paidAtDate,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        actorType: input.actorType || "SYSTEM",
        actorId: input.actorId || "SYSTEM",
        action: "MP_PIX_CHARGE_SETTLED",
        entityType: "PixCharge",
        entityId: pixCharge.id,
        metadata: {
          externalOrderId: input.externalOrderId || pixCharge.externalOrderId,
          amountCents: expectedAmt,
          installmentId,
          newStatus,
        },
      },
    });

    return { success: true, claimed: true, newStatus, newSettled };
  });
}
