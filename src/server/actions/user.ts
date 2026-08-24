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

export async function getUserProfile() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, email: null, name: null };
    }
    return { success: true, email: session.user.email, name: session.user.name };
  } catch (err) {
    return { success: false, email: null, name: null };
  }
}
