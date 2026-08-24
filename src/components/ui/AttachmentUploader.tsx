"use client";

import React, { useState, useEffect } from "react";
import { Paperclip, Upload, FileText, Trash2, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { generatePresignedUrl, confirmAttachmentUpload, getAttachmentsByOwner, deleteAttachment } from "@/server/actions/attachments";

interface AttachmentUploaderProps {
  ownerType: "FINANCIAL_ITEM" | "INSTALLMENT" | "RECEIVABLE";
  ownerId: string;
}

export function AttachmentUploader({ ownerType, ownerId }: AttachmentUploaderProps) {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  const loadAttachments = async () => {
    setLoading(true);
    try {
      const list = await getAttachmentsByOwner(ownerType, ownerId);
      setAttachments(list);
    } catch (err) {
      console.error("Erro ao carregar anexos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setFeedback(null);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const resultStr = evt.target?.result as string;
      const base64Data = resultStr ? resultStr.split(",")[1] : "";

      try {
        const res = await generatePresignedUrl({
          ownerType,
          ownerId,
          originalName: file.name,
          mimeType: file.type || "application/pdf",
          sizeBytes: file.size,
        });

        if (res.success && res.uploadUrl && res.metadata) {
          // Aqui faria o upload real via PUT
          // await fetch(res.uploadUrl, { method: "PUT", body: file });
          const confirm = await confirmAttachmentUpload(res.metadata, res.storageKey!);
          
          if (confirm.success) {
            setFeedback(`Comprovante "${file.name}" anexado com sucesso!`);
            loadAttachments();
          } else {
            setErrorMessage(confirm.error || "Erro ao confirmar anexo.");
          }
        } else {
          setErrorMessage(res.error || "Falha ao anexar comprovante.");
        }
      } catch (err: any) {
        setErrorMessage("Erro ao realizar upload do arquivo.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover o anexo "${name}"?`)) return;
    try {
      const res = await deleteAttachment(id);
      if (res.success) {
        await loadAttachments();
      }
    } catch (err) {
      console.error("Erro ao excluir anexo:", err);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-novex-border pb-2">
        <h4 className="font-bold text-novex-text-primary flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-novex-cyan" />
          <span>Comprovantes e Notas Fiscais ({attachments.length})</span>
        </h4>

        <label className="flex items-center gap-1.5 rounded-lg bg-novex-cyan/20 hover:bg-novex-cyan/30 text-novex-cyan font-bold px-3 py-1.5 text-[11px] cursor-pointer transition-colors border border-novex-cyan/40">
          <Upload className="h-3.5 w-3.5" />
          <span>{uploading ? "Enviando..." : "Anexar Arquivo"}</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            disabled={uploading}
            className="hidden"
            onChange={handleFileSelected}
          />
        </label>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/20 p-2.5 text-emerald-300 border border-emerald-500/40 text-[11px]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-500/20 p-2.5 text-rose-300 border border-rose-500/40 text-[11px]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="py-4 text-center text-novex-text-muted">Carregando anexos...</div>
      ) : attachments.length === 0 ? (
        <div className="py-4 text-center text-novex-text-muted italic text-[11px]">
          Nenhum comprovante ou nota fiscal anexada a este registro.
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-2.5 rounded-lg border border-novex-border bg-novex-surface2/60 hover:bg-novex-surface2 transition-colors"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                {att.mimeType.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 text-blue-400 shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <div className="truncate">
                  <span className="font-semibold text-novex-text-primary block truncate">{att.originalName}</span>
                  <span className="text-[10px] text-novex-text-muted font-mono">
                    {(att.sizeBytes / 1024).toFixed(1)} KB • SHA-256: {att.checksum?.slice(0, 8)}...
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleDelete(att.id, att.originalName)}
                className="p-1 rounded text-novex-text-muted hover:bg-rose-500/20 hover:text-rose-400 transition-colors shrink-0"
                title="Excluir anexo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
