"use server";

import { db } from "@/server/db";
import { requireUser } from "@/server/auth-context";

export async function changePassword(input: {
  currentPassword?: string;
  newPassword?: string;
}) {
  try {
    const user = await requireUser();

    if (!input.newPassword || input.newPassword.length < 6) {
      throw new Error("A nova senha deve ter no mínimo 6 caracteres.");
    }

    // Buscar a Account de credencial do usuário
    const account = await db.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },
    });

    if (account) {
      await db.account.update({
        where: { id: account.id },
        data: {
          password: input.newPassword,
        },
      });
    } else {
      await db.account.create({
        data: {
          userId: user.id,
          accountId: user.email,
          providerId: "credential",
          password: input.newPassword,
        },
      });
    }

    return { success: true, message: "Senha alterada com sucesso!" };
  } catch (error: any) {
    console.error("Erro ao alterar senha:", error);
    return { success: false, error: error.message };
  }
}
