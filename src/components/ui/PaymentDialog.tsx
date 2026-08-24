"use client";

import React, { useState, useMemo } from "react";
import { QrCode, Copy, Check, X, ShieldAlert, ArrowRight, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { InstallmentMock } from "@/types";
import { QRCodeSVG } from "qrcode.react";
import { generatePixPayload } from "@/lib/pix";

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  installment: InstallmentMock | null;
  accountTitle: string;
  pixKey?: string;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  installment,
  accountTitle,
  pixKey,
}) => {
  const [copied, setCopied] = useState(false);

  // Pix Copia e Cola Gerado via BACEN EMV
  const pixPayload = useMemo(() => {
    if (!pixKey || !installment) return "";
    return generatePixPayload({
      pixKey: pixKey,
      amount: installment.amountCents / 100,
      merchantName: "Novex",
      merchantCity: "Sao Paulo",
      txId: installment.uniqueReference.substring(0, 25),
    });
  }, [pixKey, installment]);

  if (!isOpen || !installment) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pixPayload);
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
          <div className="rounded-lg bg-novex-cyan/20 p-2 text-novex-cyan border border-novex-cyan/40">
            <QrCode className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-novex-text-primary">Pagar com Pix</h3>
            <p className="text-xs text-novex-text-secondary">{accountTitle}</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Detalhes do Valor e Vencimento */}
          <div className="rounded-lg bg-novex-surface2 p-3 text-center border border-novex-border/60">
            <span className="text-xs text-novex-text-muted">Valor da Parcela {installment.sequence}/{installment.totalSequences}</span>
            <div className="text-2xl font-bold text-novex-cyan mt-0.5">
              {formatCurrency(installment.amountCents)}
            </div>
            <span className="text-[11px] text-novex-text-secondary block mt-1">
              Vencimento: {formatDate(installment.dueDate)}
            </span>
          </div>

          {/* QR Code Pix */}
          <div className="flex flex-col items-center justify-center rounded-lg bg-white p-4 text-slate-900 border border-novex-border">
            {pixPayload ? (
              <>
                <QRCodeSVG value={pixPayload} size={180} />
                <span className="text-[10px] text-slate-600 mt-2 font-medium text-center">
                  Escaneie com o app do seu banco
                </span>
              </>
            ) : (
              <div className="w-44 h-44 bg-zinc-100 flex flex-col items-center justify-center text-center p-4">
                <AlertCircle className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-500">
                  Chave Pix não vinculada
                </span>
              </div>
            )}
          </div>

          {/* Pix Copia e Cola */}
          <div>
            <label className="text-xs font-medium text-novex-text-secondary block mb-1.5">
              Pix Copia e Cola (BR Code)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={pixPayload || "Nenhuma chave Pix encontrada para este favorecido."}
                className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-muted font-mono truncate"
              />
              <button
                onClick={handleCopy}
                disabled={!pixPayload}
                className="flex items-center gap-1.5 rounded-lg bg-novex-cyan px-3 py-2 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover transition-colors shrink-0 disabled:opacity-50"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? "Copiado!" : "Copiar"}</span>
              </button>
            </div>
          </div>

          {/* Informação sobre Intenção de Pagamento */}
          <div className="rounded-lg bg-novex-surface2 p-3 border border-novex-border/80 flex items-start gap-2.5 text-xs text-novex-text-secondary">
            <AlertCircle className="h-4 w-4 text-novex-cyan shrink-0 mt-0.5" />
            <span>
              Realize o pagamento pelo aplicativo do seu banco. O NOVEX identificará a movimentação de saída e dará baixa na conta automaticamente.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
