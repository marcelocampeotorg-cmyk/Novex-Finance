import { auth } from "../lib/auth.ts";
import { db } from "./db.ts";

export interface AuthenticatedWorkspaceContext {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  membershipId: string;
  role: string;
  userEmail: string;
  userName: string;
}

/**
 * Obter a sessão atual a partir das requisições HTTP (headers e cookies)
 */
export async function requireSession() {
  const { headers } = require("next/headers");
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session && session.session && new Date(session.session.expiresAt) >= new Date()) {
    return session;
  }

  throw new Error("UNAUTHORIZED: Sessão não encontrada ou expirada.");
}

/**
 * Validar o usuário autenticado e verificar se ele está ativo
 */
export async function requireUser() {
  const session = await requireSession();
  const userId = session.user.id;

  const user = await db.user.findFirst({
    where: { 
      OR: [
        { id: userId },
        { email: session.user.email }
      ]
    },
  });

  if (user && user.status === "ACTIVE") {
    return user;
  }

  throw new Error("UNAUTHORIZED: Usuário não encontrado ou inativo no banco de dados.");
}

/**
 * Resolução Central de Identidade e Workspace Autenticado.
 * Resolve o workspaceId seguro via banco de dados e Membership ativa.
 */
export async function requireAuthenticatedWorkspace(): Promise<AuthenticatedWorkspaceContext> {
  const user = await requireUser();

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

  if (membership && membership.workspace) {
    return {
      userId: user.id,
      workspaceId: membership.workspaceId,
      workspaceName: membership.workspace.name,
      membershipId: membership.id,
      role: membership.role,
      userEmail: user.email,
      userName: user.name || user.email,
    };
  }

  throw new Error("FORBIDDEN: Usuário não possui vínculo (Membership) com um workspace válido.");
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
