"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedWorkspace } from "@/server/auth-context";
import { validateAttachmentFile } from "@/services/attachments-validator";
import crypto from "crypto";

export interface UploadAttachmentInput {
  ownerType: "FINANCIAL_ITEM" | "INSTALLMENT" | "RECEIVABLE";
  ownerId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  base64Data?: string;
}

export { validateAttachmentFile };

export async function uploadAttachment(input: UploadAttachmentInput) {
  try {
    const { workspaceId, userId } = await requireAuthenticatedWorkspace();

    const validation = validateAttachmentFile(input.originalName, input.mimeType, input.sizeBytes);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const fileBuffer = input.base64Data ? Buffer.from(input.base64Data, "base64") : Buffer.from(input.originalName);
    const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const storageKey = `attachments/${workspaceId}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${input.originalName}`;

    const attachment = await db.attachment.create({
      data: {
        workspaceId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        storageKey,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: BigInt(input.sizeBytes),
        checksum,
        uploadedBy: userId,
      },
    });

    revalidatePath("/contas-a-pagar");
    revalidatePath("/contas-a-receber");
    revalidatePath("/movimentacoes");

    return {
      success: true,
      attachment: {
        id: attachment.id,
        ownerType: attachment.ownerType,
        ownerId: attachment.ownerId,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: Number(attachment.size),
        checksum: attachment.checksum,
        createdAt: attachment.createdAt.toISOString(),
      },
    };
  } catch (error: any) {
    console.error("Erro ao salvar anexo:", error);
    return { success: false, error: error.message };
  }
}

export async function getAttachmentsByOwner(ownerType: string, ownerId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    const attachments = await db.attachment.findMany({
      where: { workspaceId, ownerType, ownerId },
      orderBy: { createdAt: "desc" },
    });

    return attachments.map((att) => ({
      id: att.id,
      ownerType: att.ownerType,
      ownerId: att.ownerId,
      originalName: att.originalName,
      mimeType: att.mimeType,
      sizeBytes: Number(att.size),
      checksum: att.checksum || undefined,
      createdAt: att.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("Erro ao buscar anexos:", error);
    return [];
  }
}

export async function deleteAttachment(attachmentId: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    await db.attachment.deleteMany({
      where: { id: attachmentId, workspaceId },
    });

    revalidatePath("/contas-a-pagar");
    revalidatePath("/contas-a-receber");
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao excluir anexo:", error);
    return { success: false, error: error.message };
  }
}
