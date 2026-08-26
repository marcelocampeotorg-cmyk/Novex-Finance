import { db } from "../db.ts";

export interface SettlePixChargeInput {
  pixChargeId: string;
  paidAt?: Date;
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
    const chargeAmt = input.paidAmountCents || Number(pixCharge.amountCents);
    const paidAtDate = input.paidAt || new Date();

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

    if (!currentInstallment || currentInstallment.status === "SETTLED") {
      return { success: true, claimed: true, installmentAlreadySettled: true };
    }

    const currentSettled = Number(currentInstallment.settledAmountCents);
    const totalAmount = Number(currentInstallment.amountCents);
    const newSettled = currentSettled + chargeAmt;
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
          amountCents: chargeAmt,
          installmentId,
          newStatus,
        },
      },
    });

    return { success: true, claimed: true, newStatus, newSettled };
  });
}
