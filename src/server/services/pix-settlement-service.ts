import { db } from "../db.ts";

export interface SettlePixChargeInput {
  pixChargeId: string;
  installmentId: string;
  workspaceId: string;
  amountCents: number;
  paidAt: Date;
  actorType?: "SYSTEM" | "USER" | "WEBHOOK";
  actorId?: string;
  externalOrderId?: string;
}

/**
 * Baixa atômica unificada de PixCharge com Claim Exclusivo.
 * Garante que apenas um processo concorrente (Webhook ou Polling) transite status != 'PAID' -> 'PAID'
 * e altere a parcela/auditoria correspondente.
 */
export async function settlePixChargeAtomic(input: SettlePixChargeInput) {
  return await db.$transaction(async (tx) => {
    // 1. Claim atômico condicional: apenas se status for diferente de PAID
    const claimResult = await tx.pixCharge.updateMany({
      where: { id: input.pixChargeId, status: { not: "PAID" } },
      data: { status: "PAID", paidAt: input.paidAt, lastCheckedAt: new Date() },
    });

    // Se count === 0, outro processo ganhou a corrida — retorno idempotente sem alterar parcela
    if (claimResult.count === 0) {
      return { success: true, claimed: false, alreadyPaid: true };
    }

    // 2. Buscar parcela e incrementar apenas no processo vencedor do claim
    const currentInstallment = await tx.installment.findUnique({
      where: { id: input.installmentId },
    });

    if (!currentInstallment || currentInstallment.status === "SETTLED") {
      return { success: true, claimed: true, installmentAlreadySettled: true };
    }

    const currentSettled = Number(currentInstallment.settledAmountCents);
    const chargeAmt = Number(input.amountCents);
    const totalAmount = Number(currentInstallment.amountCents);
    const newSettled = currentSettled + chargeAmt;
    const newStatus = newSettled >= totalAmount ? "SETTLED" : "PARTIAL";

    await tx.installment.update({
      where: { id: input.installmentId },
      data: {
        settledAmountCents: BigInt(newSettled),
        status: newStatus,
        settlementDate: input.paidAt,
      },
    });

    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        actorType: input.actorType || "SYSTEM",
        actorId: input.actorId || "SYSTEM",
        action: "MP_PIX_CHARGE_SETTLED",
        entityType: "PixCharge",
        entityId: input.pixChargeId,
        metadata: {
          externalOrderId: input.externalOrderId,
          amountCents: chargeAmt,
          installmentId: input.installmentId,
          newStatus,
        },
      },
    });

    return { success: true, claimed: true, newStatus, newSettled };
  });
}
