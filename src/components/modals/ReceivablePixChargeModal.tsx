"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Copy, Check, RefreshCw, QrCode as QrIcon, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { getReceivablePixChargeStatus, generateReceivablePixCharge, PixChargeStatusResult } from "@/server/actions/pix-receivables";
import { formatCurrency } from "@/lib/formatters";

interface ReceivablePixChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  installmentId: string;
  amountCents: number;
  title: string;
  debtorName?: string;
  dueDate?: string;
  onSuccess?: () => void;
}

export function ReceivablePixChargeModal({
  isOpen,
  onClose,
  installmentId,
  amountCents,
  title,
  debtorName = "Devedor",
  dueDate,
  onSuccess,
}: ReceivablePixChargeModalProps) {
  const [chargeData, setChargeData] = useState<PixChargeStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollDelayRef = useRef(5000); // 5s inicial

  useEffect(() => {
    if (isOpen && installmentId) {
      initCharge();
    } else {
      stopPolling();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, installmentId]);

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  const initCharge = async () => {
    setLoading(true);
    setErrorMsg(null);
    stopPolling();

    try {
      const res = await generateReceivablePixCharge({ installmentId });
      if (res.success) {
        setChargeData(res);
        if (res.isPaid) {
          if (onSuccess) onSuccess();
        } else if (res.pixChargeId) {
          startPolling(res.pixChargeId);
        }
      } else {
        setErrorMsg(res.error || "Não foi possível gerar a cobrança Pix.");
      }
    } catch (e: any) {
      setErrorMsg("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (pixChargeId: string) => {
    try {
      setRefreshing(true);
      const res = await getReceivablePixChargeStatus({ pixChargeId });
      if (res.success) {
        setChargeData(res);
        if (res.isPaid) {
          stopPolling();
          if (onSuccess) onSuccess();
        }
      }
    } catch (e) {
      console.error("Erro ao verificar status Pix:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const startPolling = (pixChargeId: string) => {
    stopPolling();

    const scheduleNext = () => {
      pollingTimerRef.current = setTimeout(async () => {
        // Pausar se a aba estiver oculta
        if (document.visibilityState !== "hidden") {
          await checkStatus(pixChargeId);
        }
        // Incremento progressivo do polling (5s -> 8s -> 12s máximo)
        pollDelayRef.current = Math.min(pollDelayRef.current + 3000, 12000);
        scheduleNext();
      }, pollDelayRef.current);
    };

    scheduleNext();
  };

  const handleCopy = () => {
    if (!chargeData?.qrCode) return;
    navigator.clipboard.writeText(chargeData.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-novex-surface1 border border-novex-border rounded-2xl p-6 space-y-6 shadow-2xl relative">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-novex-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-novex-cyan/10 border border-novex-cyan/30 text-novex-cyan">
              <QrIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-novex-text-primary">Cobrar via Pix</h3>
              <p className="text-xs text-novex-text-muted">Cobrança de recebimento gerada via Mercado Pago Orders</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-novex-text-muted hover:text-novex-text-primary hover:bg-novex-surface2 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo Principal */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <span className="h-8 w-8 border-3 border-novex-cyan border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-novex-text-secondary">Gerando QR Code Pix do Mercado Pago...</span>
          </div>
        ) : errorMsg ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Falha na Cobrança</span>
              <span>{errorMsg}</span>
            </div>
          </div>
        ) : chargeData?.isPaid ? (
          <div className="py-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-bounce">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-bold text-emerald-400">Pagamento Recebido!</h4>
              <p className="text-xs text-novex-text-secondary">
                A parcela de <strong>{formatCurrency(amountCents)}</strong> foi quitada e registrada no caixa.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-novex-bg font-bold text-xs transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Cartão de Detalhes da Cobrança */}
            <div className="rounded-xl bg-novex-surface2 p-4 border border-novex-border/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-novex-text-muted uppercase font-bold tracking-wider block">Devedor / Titular</span>
                <span className="text-sm font-bold text-novex-text-primary block">{debtorName}</span>
                <span className="text-xs text-novex-text-muted">{title}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-novex-text-muted uppercase font-bold tracking-wider block">Valor a Receber</span>
                <span className="text-lg font-black text-novex-cyan tracking-tight block">{formatCurrency(amountCents)}</span>
              </div>
            </div>

            {/* QR Code Real Renderizado */}
            <div className="flex flex-col items-center justify-center p-4 bg-white/95 rounded-xl border border-novex-border shadow-inner">
              {chargeData?.qrCodeBase64 ? (
                <div className="p-2 bg-white rounded-lg flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- QR data URL oficial não é recurso otimizável pelo next/image. */}
                  <img src={chargeData.qrCodeBase64} alt="QR Code Pix" className="w-48 h-48 object-contain" />
                  <span className="text-[10px] text-slate-600 font-mono font-bold">Escaneie no App do Banco</span>
                </div>
              ) : chargeData?.qrCode ? (
                <div className="p-2 bg-white rounded-lg flex flex-col items-center gap-2">
                  {/* Fallback de SVG simples apenas se a API falhar em retornar base64 mas retornar o texto */}
                  <svg className="w-48 h-48 opacity-20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100" height="100" fill="white" />
                    <rect x="5" y="5" width="30" height="30" fill="black" />
                    <rect x="10" y="10" width="20" height="20" fill="white" />
                    <rect x="15" y="15" width="10" height="10" fill="black" />
                    <rect x="65" y="5" width="30" height="30" fill="black" />
                    <rect x="5" y="65" width="30" height="30" fill="black" />
                  </svg>
                  <span className="text-[10px] text-amber-600 font-mono font-bold">QR Code Visual Indisponível. Use o Pix Copia e Cola.</span>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">QR Code indisponível</div>
              )}
            </div>

            {/* Pix Copia e Cola */}
            {chargeData?.qrCode && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-novex-text-secondary block">Pix Copia e Cola</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={chargeData.qrCode}
                    className="w-full rounded-lg border border-novex-border bg-novex-bg p-2 text-xs font-mono text-novex-text-muted focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      copied
                        ? "bg-emerald-500 text-novex-bg shadow-sm"
                        : "bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg shadow-sm glow-cyan-subtle"
                    }`}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copied ? "Copiado!" : "Copiar"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Rodapé de Status e Polling */}
            <div className="pt-3 border-t border-novex-border/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                <Clock className="h-4 w-4 shrink-0" />
                <span className="font-semibold text-[11px]">Aguardando pagamento pelo devedor...</span>
              </div>

              <button
                onClick={() => chargeData?.pixChargeId && checkStatus(chargeData.pixChargeId)}
                disabled={refreshing}
                className="flex items-center justify-center gap-2 rounded-lg bg-novex-surface2 hover:bg-novex-surface1 border border-novex-border px-3.5 py-1.5 text-novex-text-primary text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-novex-cyan" : ""}`} />
                <span>{refreshing ? "Verificando..." : "Atualizar Status"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
