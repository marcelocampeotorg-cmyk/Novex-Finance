import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";

export interface AuthenticatedWorkspaceContext {
  userId: string;
  workspaceId: string;
  membershipId: string;
  role: string;
  userEmail: string;
  userName: string;
}

/**
 * Obter a sessão atual a partir das requisições HTTP (headers)
 */
export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || !session.session || new Date(session.session.expiresAt) < new Date()) {
    throw new Error("UNAUTHORIZED: Sessão não encontrada ou expirada.");
  }

  return session;
}

/**
 * Validar o usuário autenticado e verificar se ele está ativo
 */
export async function requireUser() {
  const session = await requireSession();
  const userId = session.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new Error("UNAUTHORIZED: Usuário inexistente ou inativo.");
  }

  return user;
}

/**
 * Resolução Central de Identidade e Workspace Autenticado.
 * Resolve o workspaceId seguro via banco de dados e Membership ativa.
 */
export async function requireAuthenticatedWorkspace(): Promise<AuthenticatedWorkspaceContext> {
  const user = await requireUser();

  // Buscar a Membership do usuário (por padrão a primeira ativa ou OWNER)
  const membership = await db.membership.findFirst({
    where: {
      userId: user.id,
      workspace: {
        type: { in: ["PERSONAL", "ORGANIZATION"] },
      },
    },
    include: {
      workspace: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!membership || !membership.workspace) {
    throw new Error("FORBIDDEN: Usuário não possui vínculo com nenhum workspace ativo.");
  }

  return {
    userId: user.id,
    workspaceId: membership.workspaceId,
    membershipId: membership.id,
    role: membership.role,
    userEmail: user.email,
    userName: user.name,
  };
}

/**
 * Exigir um papel (Role) específico dentro do Workspace
 */
export async function requireWorkspaceRole(allowedRoles: string[]): Promise<AuthenticatedWorkspaceContext> {
  const context = await requireAuthenticatedWorkspace();

  if (!allowedRoles.includes(context.role)) {
    throw new Error(`FORBIDDEN: Papel de usuário '${context.role}' não possui permissão para esta operação.`);
  }

  return context;
}
