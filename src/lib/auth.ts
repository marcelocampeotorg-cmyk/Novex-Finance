import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/server/db";

if (!process.env.AUTH_SECRET) {
  throw new Error("FATAL: Variável de ambiente AUTH_SECRET obrigatória ausente.");
}

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error("FATAL: Variável de ambiente NEXT_PUBLIC_APP_URL obrigatória ausente.");
}

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 dias
    updateAge: 24 * 60 * 60, // 1 dia
  },
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});
