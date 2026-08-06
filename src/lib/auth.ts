import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/server/db";

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
  secret: process.env.AUTH_SECRET || "novex_dev_secret_key_change_in_production_32chars",
  baseURL: process.env.APP_URL || "http://localhost:3000",
});
