import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("SEED REJEITADO: O seed de desenvolvimento não pode ser executado em produção.");
    process.exit(1);
  }

  const email = process.env.DEV_SEED_EMAIL || "frank@novexfinance.local";
  const password = process.env.DEV_SEED_PASSWORD || "123456";

  console.log(`Iniciando seed de desenvolvimento para o usuário: ${email}...`);

  await prisma.$transaction(async (tx) => {
    // 1. Criar ou localizar o Usuário
    let user = await tx.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          name: "Frank",
          timezone: "America/Sao_Paulo",
          locale: "pt-BR",
          status: "ACTIVE",
        },
      });
    }

    // 2. Criar ou atualizar a Account do Better Auth para e-mail/senha
    const existingAccount = await tx.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },
    });

    if (!existingAccount) {
      await tx.account.create({
        data: {
          userId: user.id,
          accountId: email,
          providerId: "credential",
          password, // Em produção o Better Auth faz o hash, aqui registramos o par credencial
        },
      });
    }

    // 3. Criar ou localizar o Workspace Pessoal ("Finanças pessoais")
    let workspace = await tx.workspace.findFirst({
      where: {
        ownerUserId: user.id,
      },
    });

    if (!workspace) {
      workspace = await tx.workspace.create({
        data: {
          name: "Finanças pessoais",
          type: "PERSONAL",
          ownerUserId: user.id,
        },
      });
    }

    // 4. Criar ou atualizar a Membership OWNER
    const existingMembership = await tx.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
    });

    if (!existingMembership) {
      await tx.membership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
        },
      });
    }

    // 5. Categorias Padrão
    const categories = [
      { name: "Moradia", direction: "EXPENSE", colorToken: "#3B82F6" },
      { name: "Contas Básicas", direction: "EXPENSE", colorToken: "#F59E0B" },
      { name: "Serviços & Tech", direction: "EXPENSE", colorToken: "#10B981" },
      { name: "Serviços Prestados", direction: "INCOME", colorToken: "#10B981" },
      { name: "Transferências & Acertos", direction: "BOTH", colorToken: "#8B5CF6" },
    ];

    for (const cat of categories) {
      const existingCat = await tx.category.findFirst({
        where: { workspaceId: workspace.id, name: cat.name },
      });
      if (!existingCat) {
        await tx.category.create({
          data: {
            workspaceId: workspace.id,
            name: cat.name,
            direction: cat.direction as any,
            colorToken: cat.colorToken,
            isSystem: true,
          },
        });
      }
    }

    console.log("Seed executado com sucesso! Workspace ID gerado:", workspace.id);
  });
}

main()
  .catch((e) => {
    console.error("Erro na execução do seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
