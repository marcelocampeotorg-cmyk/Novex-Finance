import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("SEED REJEITADO: O seed de desenvolvimento não pode ser executado em produção.");
    process.exit(1);
  }

  if (!process.env.DEV_SEED_PASSWORD) {
    console.error("SEED REJEITADO: Variável DEV_SEED_PASSWORD é obrigatória.");
    process.exit(1);
  }

  const email = process.env.DEV_SEED_EMAIL || "franklinjr18@hotmail.com";
  const password = process.env.DEV_SEED_PASSWORD;

  console.log(`Iniciando seed de desenvolvimento para o usuário: ${email}...`);

  let user = await prisma.user.findUnique({
    where: { email },
  });

  const hashedPassword = await hashPassword(password);

  if (!user) {
    console.log("Usuário não existe. Criando usuário e conta com hash...");
    user = await prisma.user.create({
      data: {
        email,
        name: "Dev User",
        emailVerified: true,
        accounts: {
          create: {
            accountId: email,
            providerId: "credential",
            password: hashedPassword,
          },
        },
      },
    });
  } else {
    console.log("Usuário existe. Sincronizando senha hash do dev seed...");
    const account = await prisma.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    if (account) {
      await prisma.account.update({
        where: { id: account.id },
        data: { password: hashedPassword },
      });
    } else {
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    // 3. Criar ou localizar o Workspace Pessoal ("Finanças pessoais")
    let workspace = await tx.workspace.findFirst({
      where: {
        ownerUserId: user!.id,
      },
    });

    if (!workspace) {
      workspace = await tx.workspace.create({
        data: {
          name: "Finanças pessoais",
          type: "PERSONAL",
          ownerUserId: user!.id,
        },
      });
    }

    // 4. Criar ou atualizar a Membership OWNER
    const existingMembership = await tx.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user!.id,
        },
      },
    });

    if (!existingMembership) {
      await tx.membership.create({
        data: {
          workspaceId: workspace.id,
          userId: user!.id,
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
