"use server";

import { z } from "zod";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireAuthenticatedWorkspace, requireWorkspaceRole } from "@/server/auth-context";

const centsSchema = z.number().int().safe().min(0);
const manualEntrySchema = z.object({
  direction: z.enum(["CREDIT", "DEBIT"]),
  amountCents: centsSchema.positive(),
  occurredAt: z.coerce.date(),
  description: z.string().trim().min(2).max(240),
});

async function ensureManualAccount(workspaceId: string) {
  return db.financialAccount.upsert({
    where: { workspaceId_type: { workspaceId, type: "MANUAL" } },
    update: { isActive: true },
    create: { workspaceId, type: "MANUAL", name: "Conta geral" },
  });
}

export async function getFinanceModeSettings() {
  const { workspaceId } = await requireAuthenticatedWorkspace();
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      financeMode: true,
      financialAccounts: { orderBy: { type: "asc" } },
    },
  });
  const manual = workspace?.financialAccounts.find((account) => account.type === "MANUAL");
  const mercadoPago = workspace?.financialAccounts.find((account) => account.type === "MERCADO_PAGO");
  return {
    success: true as const,
    mode: workspace?.financeMode || "MANUAL",
    manualAccount: manual ? {
      id: manual.id,
      name: manual.name,
      openingBalanceCents: manual.openingBalanceCents === null ? null : Number(manual.openingBalanceCents),
      openingBalanceAt: manual.openingBalanceAt?.toISOString() || null,
    } : null,
    mercadoPagoAccount: mercadoPago ? {
      id: mercadoPago.id,
      officialBalanceCents: mercadoPago.officialBalanceCents === null ? null : Number(mercadoPago.officialBalanceCents),
      officialBalanceAt: mercadoPago.officialBalanceAt?.toISOString() || null,
      officialBalanceStatus: mercadoPago.officialBalanceStatus,
    } : null,
  };
}

export async function configureFinanceMode(input: {
  mode: "MANUAL" | "HYBRID";
  openingBalanceCents: number;
  openingBalanceAt: string;
}) {
  const context = await requireWorkspaceRole(["OWNER", "ADMIN"]);
  const parsed = z.object({
    mode: z.enum(["MANUAL", "HYBRID"]),
    openingBalanceCents: centsSchema,
    openingBalanceAt: z.coerce.date(),
  }).safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Saldo inicial, data ou modo inválido." };

  const manual = await ensureManualAccount(context.workspaceId);
  await db.$transaction([
    db.workspace.update({ where: { id: context.workspaceId }, data: { financeMode: parsed.data.mode } }),
    db.financialAccount.update({
      where: { id: manual.id },
      data: {
        openingBalanceCents: BigInt(parsed.data.openingBalanceCents),
        openingBalanceAt: parsed.data.openingBalanceAt,
      },
    }),
    db.auditLog.create({
      data: {
        workspaceId: context.workspaceId,
        actorType: "USER",
        actorId: context.userId,
        action: "MANUAL_ACCOUNT_CONFIGURED",
        entityType: "FinancialAccount",
        entityId: manual.id,
        metadata: { mode: parsed.data.mode, openingBalanceCents: parsed.data.openingBalanceCents, openingBalanceAt: parsed.data.openingBalanceAt.toISOString() },
      },
    }),
  ]);
  revalidatePath("/");
  revalidatePath("/configuracoes");
  return { success: true as const };
}

async function createManualFact(
  tx: any,
  input: z.infer<typeof manualEntrySchema>,
  workspaceId: string,
  accountId: string,
  suffix: string,
  reversesEntryId?: string,
) {
  const external = await tx.externalTransaction.create({
    data: {
      workspaceId,
      financialAccountId: accountId,
      provider: null,
      source: "MANUAL_ADJUSTMENT",
      externalId: `manual-${suffix}`,
      direction: input.direction,
      type: reversesEntryId ? "MANUAL_REVERSAL" : "MANUAL_ENTRY",
      status: "APPROVED",
      amountCents: BigInt(input.amountCents),
      netAmountCents: BigInt(input.amountCents),
      occurredAt: input.occurredAt,
      description: input.description,
    },
  });
  const ledger = await tx.ledgerEntry.create({
    data: {
      workspaceId,
      financialAccountId: accountId,
      externalTransactionId: external.id,
      direction: input.direction,
      amountCents: BigInt(input.amountCents),
      occurredAt: input.occurredAt,
      sourceType: "MANUAL_ADJUSTMENT",
      sourceId: external.externalId,
      reversesEntryId,
    },
  });
  return { external, ledger };
}

export async function createManualTransaction(input: {
  direction: "CREDIT" | "DEBIT";
  amountCents: number;
  occurredAt: string;
  description: string;
}) {
  const context = await requireAuthenticatedWorkspace();
  const parsed = manualEntrySchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Lançamento manual inválido." };
  const account = await ensureManualAccount(context.workspaceId);
  if (!account.openingBalanceAt) return { success: false as const, error: "Configure o saldo inicial da conta geral antes de lançar movimentações." };
  if (parsed.data.occurredAt < account.openingBalanceAt) return { success: false as const, error: "A movimentação não pode ser anterior à data do saldo inicial." };

  const id = randomUUID();
  await db.$transaction(async (tx) => {
    const created = await createManualFact(tx, parsed.data, context.workspaceId, account.id, id);
    await tx.auditLog.create({
      data: { workspaceId: context.workspaceId, actorType: "USER", actorId: context.userId, action: "MANUAL_ENTRY_CREATED", entityType: "ExternalTransaction", entityId: created.external.id, metadata: { direction: parsed.data.direction, amountCents: parsed.data.amountCents } },
    });
  });
  revalidatePath("/");
  revalidatePath("/movimentacoes");
  return { success: true as const };
}

export async function replaceManualTransaction(externalTransactionId: string, replacement: {
  direction: "CREDIT" | "DEBIT";
  amountCents: number;
  occurredAt: string;
  description: string;
}) {
  const context = await requireAuthenticatedWorkspace();
  const parsed = manualEntrySchema.safeParse(replacement);
  if (!parsed.success) return { success: false as const, error: "Substituição inválida." };
  const original = await db.externalTransaction.findFirst({
    where: { id: externalTransactionId, workspaceId: context.workspaceId, source: "MANUAL_ADJUSTMENT", quarantinedAt: null },
    include: { ledgerEntries: true },
  });
  if (!original || original.ledgerEntries.length !== 1 || !original.financialAccountId) return { success: false as const, error: "Lançamento manual original não encontrado." };
  if (original.type === "MANUAL_REVERSAL") return { success: false as const, error: "Uma reversão não pode ser editada." };

  await db.$transaction(async (tx) => {
    const reversalDirection = original.direction === "CREDIT" ? "DEBIT" : "CREDIT";
    await createManualFact(tx, {
      direction: reversalDirection,
      amountCents: Number(original.netAmountCents),
      occurredAt: new Date(),
      description: `Reversão: ${original.description}`,
    }, context.workspaceId, original.financialAccountId!, `${randomUUID()}-reversal`, original.ledgerEntries[0].id);
    const created = await createManualFact(tx, parsed.data, context.workspaceId, original.financialAccountId!, `${randomUUID()}-replacement`);
    await tx.auditLog.create({
      data: { workspaceId: context.workspaceId, actorType: "USER", actorId: context.userId, action: "MANUAL_ENTRY_REPLACED", entityType: "ExternalTransaction", entityId: created.external.id, metadata: { replacesExternalTransactionId: original.id } },
    });
  });
  revalidatePath("/");
  revalidatePath("/movimentacoes");
  return { success: true as const };
}

export async function quarantineTransaction(externalTransactionId: string, reason: string) {
  const context = await requireWorkspaceRole(["OWNER", "ADMIN"]);
  const parsedReason = z.string().trim().min(5).max(500).safeParse(reason);
  if (!parsedReason.success) return { success: false as const, error: "Informe o motivo da quarentena." };
  const existing = await db.externalTransaction.findFirst({ where: { id: externalTransactionId, workspaceId: context.workspaceId } });
  if (!existing) return { success: false as const, error: "Movimentação não encontrada." };
  await db.$transaction([
    db.externalTransaction.update({ where: { id: existing.id }, data: { quarantinedAt: new Date(), quarantineReason: parsedReason.data } }),
    db.auditLog.create({ data: { workspaceId: context.workspaceId, actorType: "USER", actorId: context.userId, action: "TRANSACTION_QUARANTINED", entityType: "ExternalTransaction", entityId: existing.id, metadata: { reason: parsedReason.data } } }),
  ]);
  revalidatePath("/");
  revalidatePath("/movimentacoes");
  return { success: true as const };
}
