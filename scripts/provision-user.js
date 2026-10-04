import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function provisionUser() {
  const email = process.env.ADMIN_EMAIL || "franklinjr18@hotmail.com";
  const password = process.env.ADMIN_PASSWORD || "Novex@2026";
  const name = process.env.ADMIN_NAME || "Franklin";

  console.log(`[Provision] Configurando credenciais para: ${email}...`);

  const hashedPassword = await hashPassword(password);

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        emailVerified: true,
        status: "ACTIVE",
      },
    });
    console.log(`[Provision] Usuário criado: ID ${user.id}`);
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    console.log(`[Provision] Usuário existente atualizado: ID ${user.id}`);
  }

  // Atualiza ou cria a conta de credenciais
  const existingAccount = await prisma.account.findFirst({
    where: {
      userId: user.id,
      providerId: "credential",
    },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        password: hashedPassword,
        accountId: email,
      },
    });
    console.log("[Provision] Senha da conta existente redefinida com sucesso.");
  } else {
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: email,
        providerId: "credential",
        password: hashedPassword,
      },
    });
    console.log("[Provision] Conta de credenciais vinculada com sucesso.");
  }

  // Workspace
  let workspace = await prisma.workspace.findFirst({
    where: {
      ownerUserId: user.id,
    },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Finanças Pessoais",
        type: "PERSONAL",
        ownerUserId: user.id,
      },
    });
    console.log(`[Provision] Workspace criado: ID ${workspace.id}`);
  }

  // Membership OWNER
  const existingMembership = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
  });

  if (!existingMembership) {
    await prisma.membership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
      },
    });
    console.log("[Provision] Membership OWNER associado.");
  }

  // Categorias Padrão
  const categories = [
    { name: "Moradia", direction: "EXPENSE", colorToken: "#3B82F6" },
    { name: "Contas Básicas", direction: "EXPENSE", colorToken: "#F59E0B" },
    { name: "Alimentação & Mercado", direction: "EXPENSE", colorToken: "#10B981" },
    { name: "Transporte & Combustível", direction: "EXPENSE", colorToken: "#F59E0B" },
    { name: "Saúde & Cuidados", direction: "EXPENSE", colorToken: "#EC4899" },
    { name: "Serviços & Tech", direction: "EXPENSE", colorToken: "#06B6D4" },
    { name: "Marketing & Anúncios", direction: "EXPENSE", colorToken: "#F97316" },
    { name: "Infraestrutura & Hospedagem", direction: "EXPENSE", colorToken: "#06B6D4" },
    { name: "Softwares & Ferramentas", direction: "EXPENSE", colorToken: "#10B981" },
    { name: "Assinaturas & Lazer", direction: "EXPENSE", colorToken: "#8B5CF6" },
    { name: "Serviços Prestados", direction: "INCOME", colorToken: "#10B981" },
    { name: "Vendas & Recebíveis", direction: "INCOME", colorToken: "#10B981" },
    { name: "Transferências & Acertos", direction: "BOTH", colorToken: "#8B5CF6" },
  ];

  for (const cat of categories) {
    const existingCat = await prisma.category.findFirst({
      where: { workspaceId: workspace.id, name: cat.name },
    });
    if (!existingCat) {
      await prisma.category.create({
        data: {
          workspaceId: workspace.id,
          name: cat.name,
          direction: cat.direction,
          colorToken: cat.colorToken,
          isSystem: true,
        },
      });
    }
  }

  console.log("[Provision] Concluído com êxito! Pronto para login.");
}

provisionUser()
  .catch((e) => {
    console.error("[Provision] Erro ao provisionar:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
