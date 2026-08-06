"use client";

import React, { useState } from "react";
import { QrCode, Copy, Check, X, Send, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { InstallmentMock } from "@/types";

interface PixChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  installment: InstallmentMock | null;
  debtorName?: string;
}

export const PixChargeModal: React.FC<PixChargeModalProps> = ({
  isOpen,
  onClose,
  installment,
  debtorName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !installment) return null;

  const mockPixPayload = `00020126580014br.gov.bcb.pix0136${installment.uniqueReference}520400005303986540${(installment.amountCents / 100).toFixed(2)}5802BR5920NOVEX FINANCE PIX6009SAO PAULO62070503***6304XYZW`;

  const handleCopy = () => {
    navigator.clipboard.writeText(mockPixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-novex-text-muted hover:text-novex-text-primary"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-novex-border pb-4 mb-4">
          <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400 border border-emerald-500/40">
            <QrCode className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-novex-text-primary">Cobrança Pix Mercado Pago</h3>
            <p className="text-xs text-novex-text-secondary">Devedor: {debtorName || "Contato"}</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Valor da Cobrança */}
          <div className="rounded-lg bg-novex-surface2 p-3 text-center border border-novex-border/60">
            <span className="text-xs text-novex-text-muted">Valor a Receber</span>
            <div className="text-2xl font-bold text-emerald-400 mt-0.5">
              {formatCurrency(installment.amountCents)}
            </div>
            <span className="text-[11px] text-novex-text-secondary block mt-1">
              Vencimento: {formatDate(installment.dueDate)} • Ref: {installment.uniqueReference}
            </span>
          </div>

          {/* QR Code Simulado */}
          <div className="flex flex-col items-center justify-center rounded-lg bg-white p-4 text-slate-900 border border-novex-border">
            <div className="w-40 h-40 bg-zinc-100 border-4 border-slate-900 p-2 flex flex-col items-center justify-center relative">
              <div className="grid grid-cols-6 gap-1 w-full h-full">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className={`${
                      (i * 5) % 2 === 0 ? "bg-slate-900" : "bg-transparent"
                    } rounded-xs`}
                  />
                ))}
              </div>
              <span className="absolute bg-emerald-600 text-white font-mono text-[9px] px-1 py-0.5 rounded font-bold">
                MP PIX
              </span>
            </div>
            <span className="text-[10px] text-slate-600 mt-2 font-medium">
              Envie este QR Code ao devedor
            </span>
          </div>

          {/* Pix Copia e Cola */}
          <div>
            <label className="text-xs font-medium text-novex-text-secondary block mb-1.5">
              Código Pix Copia e Cola
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={mockPixPayload}
                className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-muted font-mono truncate"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shrink-0"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "Copiado!" : "Copiar"}</span>
              </button>
            </div>
          </div>

          {/* Ações de Envio */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => alert("Exemplo demonstrativo: Link de cobrança gerado para WhatsApp/E-mail.")}
              className="flex items-center justify-center gap-2 rounded-lg bg-novex-surface2 hover:bg-novex-border text-novex-text-primary py-2.5 text-xs font-semibold transition-colors border border-novex-border"
            >
              <Send className="h-4 w-4 text-novex-cyan" />
              <span>Enviar Cobrança</span>
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg py-2.5 text-xs font-semibold transition-colors shadow-sm"
            >
              <span>Concluído</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
