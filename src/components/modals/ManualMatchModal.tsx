"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Link2, CheckCircle2, AlertCircle, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getFinancialItems } from "@/server/actions/financial-items";
import { matchReconciliation } from "@/server/actions/transactions";

interface ExternalTx {
  id: string;
  description: string;
  amountCents: number;
  direction: "CREDIT" | "DEBIT";
  occurredAt: string;
  counterpartName?: string;
  txid?: string;
  rawReference?: string;
}

interface ManualMatchModalProps {
  isOpen: boolean;
  externalTx: ExternalTx | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualMatchModal({ isOpen, externalTx, onClose, onSuccess }: ManualMatchModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [installments, setInstallments] = useState<any[]>([]);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !externalTx) return;

    const loadCandidates = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const expectedDirection = externalTx.direction === "DEBIT" ? "PAYABLE" : "RECEIVABLE";
        const items = await getFinancialItems(expectedDirection);

        const flatInstallments: any[] = [];
        for (const item of items) {
          for (const inst of item.installments) {
            if (inst.status === "SCHEDULED" || inst.status === "OVERDUE" || inst.status === "PARTIAL") {
              flatInstallments.push({
                ...inst,
                itemTitle: item.title,
                contactName: item.contact?.name,
                categoryName: item.category,
                direction: item.direction,
              });
            }
          }
        }
        setInstallments(flatInstallments);
      } catch (err: any) {
        setErrorMessage("Erro ao carregar parcelas abertas.");
      } finally {
        setLoading(false);
      }
    };

    loadCandidates();
  }, [isOpen, externalTx]);

  if (!isOpen || !externalTx) return null;

  const filteredInstallments = installments.filter((inst) => {
    const term = searchTerm.toLowerCase();
    return (
      inst.itemTitle.toLowerCase().includes(term) ||
      (inst.contactName && inst.contactName.toLowerCase().includes(term)) ||
      inst.uniqueReference.toLowerCase().includes(term) ||
      (inst.amountCents / 100).toString().includes(term)
    );
  });

  const handleConfirmMatch = async (installmentId: string) => {
    setMatchingId(installmentId);
    setErrorMessage(null);
    try {
      const res = await matchReconciliation(externalTx.id, installmentId);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage("error" in res && res.error ? res.error : "Falha ao vincular movimentação.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de conexão ao realizar vínculo.");
    } finally {
      setMatchingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-novex-border pb-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-novex-cyan" />
            <h2 className="text-lg font-bold text-novex-text-primary">Conciliar Movimentação Manualmente</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-novex-text-muted hover:bg-novex-surface2 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo da Transação Externa */}
        <div className="rounded-xl border border-novex-border bg-novex-surface2/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <div className="text-novex-text-muted text-[10px] uppercase font-mono">Movimentação Selecionada</div>
            <div className="font-bold text-novex-text-primary text-sm">{externalTx.description}</div>
            <div className="text-novex-text-secondary text-[11px]">
              {externalTx.counterpartName ? `Favorecido: ${externalTx.counterpartName}` : "Origem bancária"} • {formatDate(externalTx.occurredAt)}
            </div>
          </div>
          <div className={`text-base font-extrabold font-mono ${externalTx.direction === "CREDIT" ? "text-emerald-400" : "text-red-400"}`}>
            {externalTx.direction === "CREDIT" ? "+" : "-"}{formatCurrency(externalTx.amountCents)}
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/20 p-3 text-xs text-rose-300 border border-rose-500/40">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Campo de Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Buscar por título, contato ou valor de ${externalTx.direction === "DEBIT" ? "Contas a Pagar" : "Contas a Receber"}...`}
            className="w-full rounded-lg border border-novex-border bg-novex-bg py-2.5 pl-9 pr-4 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none"
          />
        </div>

        {/* Lista de Parcelas Elegíveis */}
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
          {loading ? (
            <div className="py-8 text-center text-novex-text-muted">Carregando parcelas pendentes...</div>
          ) : filteredInstallments.length === 0 ? (
            <div className="py-8 text-center text-novex-text-muted">
              Nenhuma parcela pendente encontrada compatível com {externalTx.direction === "DEBIT" ? "Contas a Pagar" : "Contas a Receber"}.
            </div>
          ) : (
            filteredInstallments.map((inst) => {
              const isExactAmount = inst.amountCents === externalTx.amountCents;
              return (
                <div
                  key={inst.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isExactAmount
                      ? "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20"
                      : "border-novex-border bg-novex-surface2/30 hover:bg-novex-surface2"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-novex-text-primary">{inst.itemTitle}</span>
                      {isExactAmount && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Valor Exato!
                        </span>
                      )}
                    </div>
                    <div className="text-novex-text-muted text-[11px] flex items-center gap-2">
                      <span>{inst.contactName || "Sem contato"}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="h-3 w-3" /> Venc: {formatDate(inst.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold font-mono text-sm text-novex-text-primary">
                      {formatCurrency(inst.amountCents)}
                    </span>
                    <button
                      onClick={() => handleConfirmMatch(inst.id)}
                      disabled={matchingId === inst.id}
                      className="flex items-center gap-1 rounded-lg bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg font-bold px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span>{matchingId === inst.id ? "Vinculando..." : "Vincular"}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
