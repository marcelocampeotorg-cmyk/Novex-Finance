import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "../server/db.ts";

if (!process.env.AUTH_SECRET) {
  throw new Error("FATAL: Variável de ambiente AUTH_SECRET obrigatória ausente.");
}

const serverAuthUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;

if (!serverAuthUrl) {
  throw new Error("FATAL: Variável de ambiente BETTER_AUTH_URL ou NEXT_PUBLIC_APP_URL obrigatória ausente.");
}

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Regra RF-02: Fail-closed. Cadastro só é permitido se explicitamente autorizado via 'true'
          const isSignupExplicitlyAllowed = process.env.ALLOW_PUBLIC_SIGNUP === "true";
          if (!isSignupExplicitlyAllowed) {
            const count = await db.user.count();
            if (count > 0) {
              throw new Error("Cadastro público desativado no NOVEX Finance. Contate o administrador.");
            }
          }
          return { data: user };
        },
        after: async (user) => {
          const isSignupExplicitlyAllowed = process.env.ALLOW_PUBLIC_SIGNUP === "true";
          if (!isSignupExplicitlyAllowed) {
            const count = await db.user.count();
            if (count > 1) {
              await db.user.delete({ where: { id: user.id } }).catch(() => {});
              throw new Error("Cadastro público desativado: limite de bootstrap excedido.");
            }
          }
        },
      },
    },
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 dias
    updateAge: 24 * 60 * 60, // 1 dia
  },
  secret: process.env.AUTH_SECRET,
  baseURL: serverAuthUrl,
  trustedOrigins: [serverAuthUrl],
});
