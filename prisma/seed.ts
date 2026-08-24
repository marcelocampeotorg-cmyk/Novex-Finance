import { PrismaClient } from "@prisma/client";
import { auth } from "../src/lib/auth";
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

  const email = process.env.DEV_SEED_EMAIL || "frank@novexfinance.local";
  const password = process.env.DEV_SEED_PASSWORD;

  console.log(`Iniciando seed de desenvolvimento para o usuário: ${email}...`);

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log("Usuário não existe. Criando com Better Auth...");
    // @ts-ignore - simulando req/res se necessário, mas signUpEmail via Server API costuma funcionar
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: "Dev User",
      },
    });
    user = await prisma.user.findUnique({ where: { email } });
  }

  if (!user) {
    console.error("Falha ao criar o usuário via Better Auth.");
    process.exit(1);
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
