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

export interface PresignedUrlResult {
  success: boolean;
  uploadUrl?: string;
  storageKey?: string;
  metadata?: any;
  error?: string;
}

export async function generatePresignedUrl(input: UploadAttachmentInput): Promise<PresignedUrlResult> {
  try {
    const { workspaceId, userId } = await requireAuthenticatedWorkspace();

    const validation = validateAttachmentFile(input.originalName, input.mimeType, input.sizeBytes);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    return {
      success: false,
      error: "Armazenamento em nuvem (S3/GCS) não configurado nesta versão. Upload de anexos desativado por segurança."
    };
  } catch (error: any) {
    console.error("Erro ao gerar URL de upload:", error);
    return { success: false, error: error.message };
  }
}

export async function confirmAttachmentUpload(metadata: any, storageKey: string, checksum?: string) {
  try {
    const { workspaceId } = await requireAuthenticatedWorkspace();

    if (metadata.workspaceId !== workspaceId) {
      throw new Error("Acesso negado ao confirmar anexo.");
    }

    const attachment = await db.attachment.create({
      data: {
        workspaceId,
        ownerType: metadata.ownerType,
        ownerId: metadata.ownerId,
        storageKey,
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        size: BigInt(metadata.sizeBytes),
        checksum,
        uploadedBy: metadata.uploadedBy,
      },
    });

    revalidatePath("/contas-a-pagar");
    revalidatePath("/contas-a-receber");
    revalidatePath("/movimentacoes");

    return { success: true, attachmentId: attachment.id };
  } catch (error: any) {
    // Se o create falhar, deveríamos disparar a deleção do S3 (Evitar arquivo fantasma)
    // await s3Client.send(new DeleteObjectCommand({ Bucket, Key: storageKey }));
    console.error("Erro ao confirmar anexo:", error);
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
