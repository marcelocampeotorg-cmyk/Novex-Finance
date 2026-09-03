"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Tag, Check, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { updateTransactionCategoryAction, getWorkspaceCategoriesAction } from "@/server/actions/reconciliation";

interface CategoryLearnModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any | null;
  onSuccess: () => void;
}

export const CategoryLearnModal: React.FC<CategoryLearnModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}) => {
  const [categories, setCategories] = useState<{ id: string; name: string; colorToken?: string | null }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [shouldLearn, setShouldLearn] = useState(true);
  const [pattern, setPattern] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && transaction) {
      getWorkspaceCategoriesAction().then((cats) => {
        setCategories(cats || []);
        // Tenta encontrar a categoria atual da transação
        const currentCat = cats.find((c) => c.name === transaction.category);
        if (currentCat) {
          setSelectedCategoryId(currentCat.id);
        } else if (cats.length > 0) {
          setSelectedCategoryId(cats[0].id);
        }
      });

      // Extrai um termo sugestivo para regra (primeira palavra relevante ou contraparte)
      const baseText = transaction.counterpartName || transaction.description || "";
      const cleanWord = baseText
        .replace(/^(pix\s*recebido\s*-?|pag\s*\*|compra\s*cartao\s*)/i, "")
        .trim()
        .split(/[\s*-]/)[0]
        ?.trim();

      setPattern(cleanWord && cleanWord.length >= 3 ? cleanWord : baseText.slice(0, 20));
      setShouldLearn(true);
      setError(null);
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      setError("Selecione uma categoria.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const learnPattern = shouldLearn && pattern.trim().length >= 2 ? pattern.trim() : undefined;
      const res = await updateTransactionCategoryAction(transaction.id, selectedCategoryId, learnPattern);
      if (!res.success) {
        throw new Error("Falha ao atualizar categoria.");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar categoria.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

      {/* Container do Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
        {/* Topo com Ícone e Fechar */}
        <div className="flex items-center justify-between pb-4 border-b border-novex-border/80">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-novex-cyan/15 text-novex-cyan border border-novex-cyan/30">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-novex-text-primary">Categorização Inteligente</h3>
              <p className="text-[11px] text-novex-text-muted">Associe categoria e ensine o sistema a reconhecer compras futuras.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-novex-text-muted hover:text-novex-text-primary hover:bg-novex-surface2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Detalhes da Movimentação */}
        <div className="my-4 p-3.5 rounded-xl border border-novex-border/70 bg-novex-surface2/50 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-novex-text-primary truncate">
              {transaction.description}
            </div>
            {transaction.counterpartName && (
              <div className="text-[11px] text-novex-text-muted truncate mt-0.5">
                Favorecido: {transaction.counterpartName}
              </div>
            )}
          </div>
          <div className={`text-sm font-bold shrink-0 ${transaction.direction === "CREDIT" ? "text-emerald-400" : "text-red-400"}`}>
            {transaction.direction === "CREDIT" ? "+" : "-"}{formatCurrency(transaction.amountCents)}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Seleção de Categoria */}
          <div>
            <label className="block text-xs font-semibold text-novex-text-secondary mb-1.5">
              Categoria Desejada
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full rounded-xl border border-novex-border bg-novex-bg py-2.5 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Opção de Aprendizado Automático */}
          <div className="p-3.5 rounded-xl border border-novex-cyan/20 bg-novex-cyan/5 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shouldLearn}
                onChange={(e) => setShouldLearn(e.target.checked)}
                className="h-4 w-4 rounded border-novex-border bg-novex-bg text-novex-cyan focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs font-semibold text-novex-text-primary">
                Salvar regra no banco para categorizar automático
              </span>
            </label>

            {shouldLearn && (
              <div className="pt-1">
                <label className="block text-[11px] text-novex-text-secondary mb-1">
                  Reconhecer transações que contenham a palavra ou termo:
                </label>
                <input
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="Ex: Uber, Posto, Carrefour..."
                  className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none font-mono"
                />
                <p className="text-[10px] text-novex-text-muted mt-1">
                  Todas as movimentações existentes e futuras contendo esse termo serão auto-categorizadas.
                </p>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-novex-border bg-transparent px-4 py-2.5 text-xs font-semibold text-novex-text-secondary hover:bg-novex-surface2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg px-5 py-2.5 text-xs font-bold transition-all shadow-sm glow-cyan-subtle disabled:opacity-50"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>{loading ? "Salvando..." : "Salvar & Aplicar"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
