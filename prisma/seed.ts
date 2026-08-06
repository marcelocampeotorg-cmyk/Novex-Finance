import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do banco de dados NOVEX Finance...");

  // Criar Usuário Inicial
  const user = await prisma.user.upsert({
    where: { email: "frank@novexfinance.local" },
    update: {},
    create: {
      email: "frank@novexfinance.local",
      name: "Frank",
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
    },
  });

  // Criar Workspace Pessoal
  const workspace = await prisma.workspace.upsert({
    where: { id: "ws-personal-demo" },
    update: {},
    create: {
      id: "ws-personal-demo",
      name: "Workspace Pessoal — Frank",
      type: "PERSONAL",
      ownerUserId: user.id,
    },
  });

  // Criar Membership
  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  // Categorias do sistema
  const categories = [
    { name: "Moradia", direction: "EXPENSE", colorToken: "#3B82F6" },
    { name: "Contas Básicas", direction: "EXPENSE", colorToken: "#F59E0B" },
    { name: "Serviços & Tech", direction: "EXPENSE", colorToken: "#10B981" },
    { name: "Serviços Prestados", direction: "INCOME", colorToken: "#10B981" },
    { name: "Transferências & Acertos", direction: "BOTH", colorToken: "#8B5CF6" },
  ];

  for (const cat of categories) {
    await prisma.category.create({
      data: {
        workspaceId: workspace.id,
        name: cat.name,
        direction: cat.direction as any,
        colorToken: cat.colorToken,
        isSystem: true,
      },
    });
  }

  console.log("Seed concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
