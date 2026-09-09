const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");
const prisma = new PrismaClient();

async function main() {
  const workspaceId = "28bac964-1e8b-4adb-8f67-a2c00ee23fbe";
  const targetRealAmountCents = 12000; // R$ 120,00

  const manualAccount = await prisma.financialAccount.findFirst({
    where: { workspaceId, type: "MANUAL" },
  });

  if (!manualAccount) {
    console.error("Conta manual não encontrada.");
    return;
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { workspaceId, financialAccountId: manualAccount.id },
  });

  let currentBalanceCents = Number(manualAccount.openingBalanceCents || 0);
  for (const e of entries) {
    currentBalanceCents += (e.direction === "CREDIT" ? 1 : -1) * Number(e.amountCents);
  }

  const diffCents = targetRealAmountCents - currentBalanceCents;
  console.log("Saldo Atual:", currentBalanceCents / 100, "Alvo:", targetRealAmountCents / 100, "Diferenca:", diffCents / 100);

  if (diffCents === 0) {
    console.log("Saldo já está em R$ 120,00.");
    return;
  }

  const direction = diffCents > 0 ? "CREDIT" : "DEBIT";
  const amountCents = Math.abs(diffCents);
  const now = new Date();
  const externalId = `manual-wallet-adjust-${randomUUID()}`;
  const fullDescription = `Conferência de Carteira (Saída) — Conferência física da carteira`;

  // Buscar categoria pessoal se existir
  const personalCategory = await prisma.category.findFirst({
    where: { workspaceId, name: { contains: "Pessoal", mode: "insensitive" } }
  });

  await prisma["$transaction"](async (tx) => {
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
          paymentMethod: "CASH",
          methodLabel: "Cédula / Dinheiro em espécie",
          previousBalanceCents: currentBalanceCents,
          adjustedBalanceCents: targetRealAmountCents,
          diffCents,
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
        categoryId: personalCategory ? personalCategory.id : null,
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
  });

  console.log("SUCESSO: Saldo da carteira em espécie ajustado para R$ 120,00!");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
