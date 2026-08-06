"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";

const DEMO_WORKSPACE_ID = "ws-personal-demo";
const UPLOADS_DIR = process.env.UPLOADS_DIR || "./uploads";

export async function uploadAttachment(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    const ownerType = (formData.get("ownerType") as string) || "FINANCIAL_ITEM";
    const ownerId = (formData.get("ownerId") as string) || "demo-owner";

    if (!file) throw new Error("Nenhum arquivo enviado");

    // Limite de 10MB
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Tamanho máximo de arquivo excedido (Limite: 10MB)");
    }

    // Tipos permitidos: PDF, PNG, JPG, JPEG
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Tipo de arquivo não permitido (Aceitos: PDF, PNG, JPG)");
    }

    // Criar diretório de upload se não existir
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const fileExt = path.extname(file.name);
    const storageKey = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${fileExt}`;
    const filePath = path.join(UPLOADS_DIR, storageKey);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Gravar registro no banco
    const attachment = await db.attachment.create({
      data: {
        workspaceId: DEMO_WORKSPACE_ID,
        ownerType,
        ownerId,
        storageKey,
        originalName: file.name,
        mimeType: file.type,
        size: BigInt(file.size),
        uploadedBy: "Frank",
      },
    });

    revalidatePath("/contas-a-pagar");
    return { success: true, attachmentId: attachment.id, fileName: file.name };
  } catch (error: any) {
    console.error("Erro no upload de anexo:", error);
    return { success: false, error: error.message };
  }
}
