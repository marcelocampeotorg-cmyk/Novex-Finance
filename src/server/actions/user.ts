"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function changePassword(input: {
  currentPassword?: string;
  newPassword?: string;
}) {
  try {
    if (!input.currentPassword || !input.newPassword || input.newPassword.length < 6) {
      throw new Error("A senha atual é obrigatória e a nova senha deve ter no mínimo 6 caracteres.");
    }

    await auth.api.changePassword({
      body: {
        newPassword: input.newPassword,
        currentPassword: input.currentPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });

    return { success: true, message: "Senha alterada com sucesso!" };
  } catch (error: any) {
    console.error("Erro ao alterar senha:", error);
    return { success: false, error: error.message || "Senha atual incorreta ou erro interno." };
  }
}
