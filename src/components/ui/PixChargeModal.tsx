"use client";

import React, { useState, useEffect } from "react";
import { QrCode, Copy, Check, X, Send, AlertCircle, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { InstallmentDTO } from "@/types";
import { QRCodeSVG } from "qrcode.react";

import { generateReceivablePixCharge, PixChargeStatusResult } from "@/server/actions/pix-receivables";
import { sendWhatsAppDebtorReminder } from "@/server/actions/notifications";

interface PixChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  installment: InstallmentDTO | null;
  debtorName?: string;
}

export const PixChargeModal: React.FC<PixChargeModalProps> = ({
  isOpen,
  onClose,
  installment,
  debtorName,
}) => {
  const [copied, setCopied] = useState(false);
  const [chargeData, setChargeData] = useState<PixChargeStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (isOpen && installment) {
      setChargeData(null);
      setErrorMsg(null);
      setMsgFeedback(null);
      setLoading(true);

      generateReceivablePixCharge({ installmentId: installment.id })
        .then((res) => {
          if (res.success) {
            setChargeData(res);
          } else {
            setErrorMsg(res.error || "Erro ao gerar cobrança.");
          }
        })
        .catch((err) => {
          setErrorMsg("Falha de comunicação com o servidor.");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, installment]);

  if (!isOpen || !installment) return null;

  const handleCopy = () => {
    if (!chargeData?.qrCode) return;
    navigator.clipboard.writeText(chargeData.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendReminder = async () => {
    if (!chargeData?.pixChargeId) return;

    setSendingMsg(true);
    setMsgFeedback(null);

    try {
      const res = await sendWhatsAppDebtorReminder({
        pixChargeId: chargeData.pixChargeId,
        messageStage: "MANUAL",
      });

      if (res.success) {
        setMsgFeedback({ type: "success", msg: "Cobrança enviada com sucesso!" });
        setTimeout(() => setMsgFeedback(null), 3000);
      } else {
        setMsgFeedback({ type: "error", msg: res.error || "Erro ao enviar cobrança." });
      }
    } catch (err: any) {
      setMsgFeedback({ type: "error", msg: "Falha de comunicação ao enviar cobrança." });
    } finally {
      setSendingMsg(false);
    }
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

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 text-novex-cyan animate-spin" />
            <span className="text-sm text-novex-text-secondary">Gerando cobrança Pix oficial...</span>
          </div>
        ) : errorMsg ? (
          <div className="py-8 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <div className="text-sm text-red-400 font-medium px-4">{errorMsg}</div>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 rounded-lg bg-novex-surface2 border border-novex-border text-novex-text-primary text-xs font-bold"
            >
              Fechar
            </button>
          </div>
        ) : chargeData ? (
          <div className="space-y-5">
            <div className="rounded-lg bg-novex-surface2 p-3 text-center border border-novex-border/60">
              <span className="text-xs text-novex-text-muted">Valor a Receber</span>
              <div className="text-2xl font-bold text-emerald-400 mt-0.5">
                {formatCurrency(chargeData.amountCents || installment.amountCents)}
              </div>
              <span className="text-[11px] text-novex-text-secondary block mt-1">
                Vencimento: {formatDate(installment.dueDate)} • Ref: {installment.uniqueReference}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-lg bg-white p-4 text-slate-900 border border-novex-border">
              {chargeData.qrCode ? (
                <QRCodeSVG
                  value={chargeData.qrCode}
                  size={160}
                  level="M"
                  includeMargin={false}
                />
              ) : (
                <div className="w-40 h-40 bg-zinc-100 flex items-center justify-center text-xs text-slate-500 text-center px-4">
                  QR Code indisponível
                </div>
              )}
              <span className="text-[10px] text-slate-600 mt-3 font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                Mercado Pago Pix
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-novex-text-secondary block mb-1.5">
                Código Pix Copia e Cola
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={chargeData.qrCode || ""}
                  className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-muted font-mono truncate"
                  placeholder="Aguardando código..."
                />
                <button
                  onClick={handleCopy}
                  disabled={!chargeData.qrCode}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shrink-0 disabled:opacity-50"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>

            {msgFeedback && (
              <div className={`text-[11px] px-3 py-2 rounded-lg border ${
                msgFeedback.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}>
                {msgFeedback.msg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleSendReminder}
                disabled={sendingMsg}
                className="flex items-center justify-center gap-2 rounded-lg bg-novex-surface2 hover:bg-novex-border text-novex-text-primary py-2.5 text-xs font-semibold transition-colors border border-novex-border disabled:opacity-50"
              >
                {sendingMsg ? (
                  <RefreshCw className="h-4 w-4 text-novex-cyan animate-spin" />
                ) : (
                  <Send className="h-4 w-4 text-novex-cyan" />
                )}
                <span>{sendingMsg ? "Enviando..." : "Enviar Cobrança"}</span>
              </button>
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg py-2.5 text-xs font-semibold transition-colors shadow-sm"
              >
                <span>Concluído</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
