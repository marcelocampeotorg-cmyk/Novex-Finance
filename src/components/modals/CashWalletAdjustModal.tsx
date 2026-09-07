"use client";

import React, { useState, useEffect } from "react";
import { Banknote, X, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { adjustCashWalletBalance } from "@/server/actions/cash-wallet";

interface CashWalletAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalanceCents: number;
  onSuccess?: (newBalanceCents: number) => void;
}

export function CashWalletAdjustModal({
  isOpen,
  onClose,
  currentBalanceCents,
  onSuccess,
}: CashWalletAdjustModalProps) {
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmountStr((currentBalanceCents / 100).toFixed(2).replace(".", ","));
      setDescription("");
      setErrorMessage(null);
    }
  }, [isOpen, currentBalanceCents]);

  if (!isOpen) return null;

  const parsedRealAmountCents = Math.round(
    Number(amountStr.replace(/\./g, "").replace(",", ".")) * 100
  );
  const isValidAmount = Number.isFinite(parsedRealAmountCents) && parsedRealAmountCents >= 0;
  const diffCents = isValidAmount ? parsedRealAmountCents - currentBalanceCents : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) {
      setErrorMessage("Informe um valor válido em reais.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await adjustCashWalletBalance({
        currentRealAmountCents: parsedRealAmountCents,
        description: description.trim() || undefined,
      });

      if (res.success) {
        if (onSuccess) onSuccess(parsedRealAmountCents);
        onClose();
      } else {
        setErrorMessage(res.error || "Falha ao ajustar carteira.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro inesperado ao ajustar saldo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl shadow-black/80">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-novex-text-muted hover:text-novex-text-primary transition-colors p-1"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-novex-cyan/15 border border-novex-cyan/30 flex items-center justify-center text-novex-cyan">
            <Banknote className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-novex-text-primary">Conferir Dinheiro na Carteira</h3>
            <p className="text-xs text-novex-text-muted">Ajuste rápido para bater com as notas no seu bolso</p>
          </div>
        </div>

        {/* Informações do Saldo Atual */}
        <div className="mb-4 rounded-xl border border-novex-border/80 bg-novex-surface2/50 p-3.5 flex items-center justify-between">
          <span className="text-xs text-novex-text-muted">Saldo registrado no sistema:</span>
          <span className="text-sm font-bold text-novex-text-primary font-mono">
            {formatCurrency(currentBalanceCents)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input do valor em mãos */}
          <div>
            <label className="block text-xs font-semibold text-novex-text-primary mb-1.5">
              Quanto você tem em mãos agora? (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-novex-text-muted font-bold">R$</span>
              <input
                type="text"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-novex-border bg-novex-bg text-sm font-bold text-novex-text-primary focus:border-novex-cyan focus:ring-1 focus:ring-novex-cyan focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Feedback da diferença */}
          {isValidAmount && diffCents !== 0 && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                diffCents < 0
                  ? "bg-red-500/10 border-red-500/30 text-red-300"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              }`}
            >
              {diffCents < 0 ? (
                <ArrowDownRight className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              ) : (
                <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-bold block">
                  {diffCents < 0 ? "Saída identificada: " : "Entrada identificada: "}
                  {formatCurrency(Math.abs(diffCents))}
                </span>
                <span className="text-[11px] opacity-80">
                  {diffCents < 0
                    ? "O sistema vai registrar este valor como gasto em dinheiro no seu mês."
                    : "O sistema vai registrar este valor como entrada em dinheiro no caixa."}
                </span>
              </div>
            </div>
          )}

          {isValidAmount && diffCents === 0 && (
            <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>O valor digitado é idêntico ao saldo do sistema. Nenhuma alteração necessária.</span>
            </div>
          )}

          {/* Motivo do gasto / entrada */}
          {isValidAmount && diffCents !== 0 && (
            <div>
              <label className="block text-xs font-semibold text-novex-text-primary mb-1.5">
                {diffCents < 0 ? "Onde foi gasto? (Motivo da despesa)" : "Origem do dinheiro em espécie"}
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={diffCents < 0 ? "Ex: Almoço na rua, padaria, casamento do Alex" : "Ex: Troco guardado, sobra de viagem"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-novex-border bg-novex-bg text-xs text-novex-text-primary placeholder:text-novex-text-muted/60 focus:border-novex-cyan focus:ring-1 focus:ring-novex-cyan focus:outline-none"
              />
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Ações */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-novex-text-muted hover:text-novex-text-primary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isValidAmount}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg font-bold text-xs transition-all shadow-lg shadow-novex-cyan/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Ajustando...</span>
                </>
              ) : (
                <span>Confirmar Saldo em Mãos</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
