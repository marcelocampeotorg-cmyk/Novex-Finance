export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateAttachmentFile(originalName: string, mimeType: string, sizeBytes: number) {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "O tamanho máximo do arquivo é de 10MB." };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return { valid: false, error: "Formato de arquivo não suportado. Envie PDF, PNG ou JPEG." };
  }

  return { valid: true };
}
