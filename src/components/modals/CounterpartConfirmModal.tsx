"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Building2, Sparkles, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { confirmTransactionCounterpart } from "@/server/actions/transactions";

interface CounterpartConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any | null;
  onSuccess: () => void;
}

export const CounterpartConfirmModal: React.FC<CounterpartConfirmModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}) => {
  const [counterpartName, setCounterpartName] = useState("");
  const [rememberRule, setRememberRule] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && transaction) {
      setCounterpartName(transaction.counterpartName || transaction.identifiedMerchant || "");
      setRememberRule(true);
      setError(null);
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterpartName.trim() || counterpartName.trim().length < 2) {
      setError("Informe um nome válido para o favorecido (mínimo de 2 caracteres).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await confirmTransactionCounterpart({
        externalTransactionId: transaction.id,
        counterpartName: counterpartName.trim(),
        rememberRule,
      });

      if (!res.success) {
        setError(res.error || "Erro ao confirmar favorecido.");
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-novex-surface border border-novex-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-novex-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-novex-text-primary">
                Confirmar Favorecido / Fornecedor
              </h3>
              <p className="text-xs text-novex-text-muted">
                Memória viva de identificação de transações
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-novex-text-muted hover:text-novex-text-primary p-1 rounded-lg hover:bg-novex-surface2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Card da Transação */}
          <div className="p-3 rounded-lg bg-novex-surface2/50 border border-novex-border/80 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-novex-text-muted">Descrição original:</span>
              <span className={`font-semibold ${transaction.direction === "CREDIT" ? "text-emerald-400" : "text-red-400"}`}>
                {transaction.direction === "CREDIT" ? "+" : "-"} {formatCurrency(transaction.amountCents / 100)}
              </span>
            </div>
            <div className="text-xs font-medium text-novex-text-primary truncate">
              {transaction.description || "Transação sem descrição"}
            </div>
          </div>

          {/* Campo de Nome do Favorecido */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-novex-text-secondary flex items-center justify-between">
              <span>Nome do Favorecido / Empresa</span>
              <span className="text-[10px] text-novex-text-muted">Como você deseja visualizar</span>
            </label>
            <input
              type="text"
              value={counterpartName}
              onChange={(e) => setCounterpartName(e.target.value)}
              placeholder="Ex.: Facebook Serviços Online, Posto Shell, etc."
              className="w-full px-3 py-2 text-xs bg-novex-surface2 border border-novex-border rounded-lg text-novex-text-primary placeholder:text-novex-text-muted focus:outline-none focus:border-emerald-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Opção de Lembrar e Criar Regra de Aprendizado */}
          <div className="p-3 rounded-lg border border-novex-border/80 bg-novex-surface2/30 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberRule}
                onChange={(e) => setRememberRule(e.target.checked)}
                className="mt-0.5 rounded border-novex-border text-emerald-500 focus:ring-emerald-500/20"
              />
              <div>
                <div className="text-xs font-medium text-novex-text-primary flex items-center gap-1.5">
                  <span>Lembrar para o futuro</span>
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </div>
                <p className="text-[11px] text-novex-text-muted mt-0.5 leading-relaxed">
                  Aprender este padrão no catálogo de fornecedores. Próximas saídas Pix ou pagamentos similares serão identificados automaticamente.
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm"
            >
              {loading ? (
                "Salvando..."
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar Favorecido</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
