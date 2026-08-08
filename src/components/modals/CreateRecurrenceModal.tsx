"use client";

import React, { useState } from "react";
import { X, Repeat, CheckCircle2, AlertCircle } from "lucide-react";
import { createRecurrenceRule } from "@/server/actions/recurrence";

interface CreateRecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateRecurrenceModal({ isOpen, onClose, onSuccess }: CreateRecurrenceModalProps) {
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState<"PAYABLE" | "RECEIVABLE">("PAYABLE");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"MONTHLY" | "WEEKLY" | "ANNUAL">("MONTHLY");
  const [dayOfMonth, setDayOfMonth] = useState("5");
  const [categoryName, setCategoryName] = useState("Serviços & Assinaturas");
  const [contactName, setContactName] = useState("");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().split("T")[0]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) {
      setErrorMessage("Preencha os campos obrigatórios (Título e Valor).");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);

    try {
      const res = await createRecurrenceRule({
        title,
        direction,
        amountCents,
        frequency,
        dayOfMonth: parseInt(dayOfMonth, 10) || 5,
        categoryName,
        startsAt,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage("error" in res && res.error ? res.error : "Falha ao criar regra de recorrência.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao salvar recorrência.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-novex-border pb-4">
          <div className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-novex-cyan" />
            <h2 className="text-lg font-bold text-novex-text-primary">Nova Regra Recorrente</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-novex-text-muted hover:bg-novex-surface2 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/20 p-3 text-xs text-rose-300 border border-rose-500/40">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-novex-text-muted font-semibold block mb-1">Título da Recorrência *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aluguel do Escritório, Assinatura AWS"
              className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-novex-text-muted font-semibold block mb-1">Tipo / Direção</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
                className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              >
                <option value="PAYABLE">Despesa (Conta a Pagar)</option>
                <option value="RECEIVABLE">Receita (Conta a Receber)</option>
              </select>
            </div>

            <div>
              <label className="text-novex-text-muted font-semibold block mb-1">Valor por Período (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1500.00"
                className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-novex-text-muted font-semibold block mb-1">Frequência</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              >
                <option value="MONTHLY">Mensal</option>
                <option value="WEEKLY">Semanal</option>
                <option value="ANNUAL">Anual</option>
              </select>
            </div>

            <div>
              <label className="text-novex-text-muted font-semibold block mb-1">Dia do Vencimento</label>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-novex-text-muted font-semibold block mb-1">Data Início</label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-novex-text-muted font-semibold block mb-1">Categoria</label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
            </div>

            <div>
              <label className="text-novex-text-muted font-semibold block mb-1">Favorecido / Contato</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: Imobiliária Central"
                className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg font-bold py-3 text-xs transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{loading ? "Criando Regra..." : "Salvar Regra Recorrente"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
