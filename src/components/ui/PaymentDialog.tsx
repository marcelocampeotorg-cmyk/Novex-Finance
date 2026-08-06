"use client";

import React, { useState } from "react";
import { QrCode, Copy, Check, X, ShieldAlert, ArrowRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { InstallmentMock } from "@/types";

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  installment: InstallmentMock | null;
  accountTitle: string;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  isOpen,
  onClose,
  installment,
  accountTitle,
}) => {
  const [copied, setCopied] = useState(false);
  const [simulatedStatus, setSimulatedStatus] = useState<"PENDING" | "PROCESSING" | "SETTLED">("PENDING");

  if (!isOpen || !installment) return null;

  // Pix Copia e Cola simulado para pagamento via Mercado Pago
  const mockPixPayload = `00020126580014br.gov.bcb.pix0136${installment.uniqueReference}520400005303986540${(installment.amountCents / 100).toFixed(2)}5802BR5920NOVEX FINANCE PIX6009SAO PAULO62070503***6304ABCD`;

  const handleCopy = () => {
    navigator.clipboard.writeText(mockPixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulatePayment = () => {
    setSimulatedStatus("PROCESSING");
    setTimeout(() => {
      setSimulatedStatus("SETTLED");
    }, 1500);
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

        {simulatedStatus === "SETTLED" ? (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Check className="h-8 w-8 stroke-[3]" />
            </div>
            <h4 className="text-lg font-bold text-emerald-400">Pagamento Reconhecido!</h4>
            <p className="text-xs text-novex-text-secondary max-w-xs mx-auto">
              A movimentação de saída foi conciliada automaticamente com o Mercado Pago. O status da parcela foi atualizado para <strong>Paga</strong>.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-novex-surface2 py-2.5 text-xs font-semibold text-novex-text-primary hover:bg-novex-border"
            >
              Fechar
            </button>
          </div>
        ) : (
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

            {/* Simulação do QR Code Pix */}
            <div className="flex flex-col items-center justify-center rounded-lg bg-white p-4 text-slate-900 border border-novex-border">
              <div className="w-44 h-44 bg-zinc-100 border-4 border-slate-900 p-2 flex flex-col items-center justify-center relative">
                {/* Visual SVG Simulado de QR Code */}
                <div className="grid grid-cols-6 gap-1 w-full h-full">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div
                      key={i}
                      className={`${
                        (i * 7) % 3 === 0 ? "bg-slate-900" : "bg-transparent"
                      } rounded-xs`}
                    />
                  ))}
                </div>
                <span className="absolute bg-slate-900 text-cyan-400 font-mono text-[9px] px-1 py-0.5 rounded font-bold">
                  PIX DEMO
                </span>
              </div>
              <span className="text-[10px] text-slate-600 mt-2 font-medium">
                Escaneie com o app do Mercado Pago
              </span>
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
                  value={mockPixPayload}
                  className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-muted font-mono truncate"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg bg-novex-cyan px-3 py-2 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover transition-colors shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>

            {/* Alerta de Fluxo Real */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-[11px] text-amber-300 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong>Modo Demonstrativo:</strong> O NOVEX gera o QR Code Pix com identificador único. Após você pagar no app do seu banco, a sincronização reconhece a saída e atualiza o painel automaticamente.
              </span>
            </div>

            {/* Botão para Simular Confirmação no Teste */}
            <button
              onClick={handleSimulatePayment}
              disabled={simulatedStatus === "PROCESSING"}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 text-xs transition-colors shadow-sm"
            >
              {simulatedStatus === "PROCESSING" ? (
                <span>Aguardando conciliação Mercado Pago...</span>
              ) : (
                <>
                  <span>Simular Pagamento Efetuado</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
