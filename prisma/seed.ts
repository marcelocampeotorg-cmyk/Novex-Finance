import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("SEED REJEITADO: O seed de desenvolvimento não pode ser executado em produção.");
    process.exit(1);
  }

  if (!process.env.DEV_SEED_EMAIL || !process.env.DEV_SEED_PASSWORD) {
    console.error("SEED REJEITADO: Variáveis de ambiente DEV_SEED_EMAIL e DEV_SEED_PASSWORD são obrigatórias.");
    process.exit(1);
  }

  const email = process.env.DEV_SEED_EMAIL;
  const password = process.env.DEV_SEED_PASSWORD;

  console.log(`Iniciando seed de desenvolvimento controlado para o usuário: ${email}...`);

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log("Usuário não existe. Criando usuário e conta inicial...");
    const hashedPassword = await hashPassword(password);
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
    console.log("Usuário já existe no banco. Preservando credenciais existentes sem sobrescrever.");
  }

  await prisma.$transaction(async (tx) => {
    // Workspace Pessoal ("Finanças pessoais")
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

    // Membership OWNER
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

    // Categorias Padrão Base (sem criar movimentações, saldo ou itens fictícios)
    const categories = [
      { name: "Moradia", direction: "EXPENSE", colorToken: "#3B82F6" },
      { name: "Contas Básicas", direction: "EXPENSE", colorToken: "#F59E0B" },
      { name: "Serviços & Tech", direction: "EXPENSE", colorToken: "#10B981" },
      { name: "Marketing & Anúncios", direction: "EXPENSE", colorToken: "#F97316" },
      { name: "Infraestrutura & Hospedagem", direction: "EXPENSE", colorToken: "#06B6D4" },
      { name: "Softwares & Ferramentas", direction: "EXPENSE", colorToken: "#10B981" },
      { name: "Assinaturas & Lazer", direction: "EXPENSE", colorToken: "#8B5CF6" },
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

    console.log("Seed de desenvolvimento concluído com sucesso! Workspace ID:", workspace.id);
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
