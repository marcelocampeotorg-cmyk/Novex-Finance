"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, User, Tag, Paperclip, CreditCard, History, CheckCircle2, Clock, Trash2, Scale, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FinancialItemDTO } from "@/types";
import {
  isPensionItem,
  parsePensionIndexerTag,
  DEFAULT_MINIMUM_WAGE_CENTS,
  DEFAULT_PENSION_PERCENTAGE,
  calculatePensionInstallmentCents,
} from "@/domain/pension-indexer";
import { adjustPensionMinimumWage } from "@/server/actions/financial-items";
import { notifyStoreChange } from "@/services/financial-store";

interface AccountDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: FinancialItemDTO | null;
  onPayClick?: (installment: any) => void;
  onDelete?: (item: FinancialItemDTO) => void;
}

export const AccountDetailsDrawer: React.FC<AccountDetailsDrawerProps> = ({
  isOpen,
  onClose,
  item,
  onPayClick,
  onDelete,
}) => {
  const [currentItem, setCurrentItem] = useState<FinancialItemDTO | null>(item);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustWage, setAdjustWage] = useState(DEFAULT_MINIMUM_WAGE_CENTS / 100);
  const [adjustPercentage, setAdjustPercentage] = useState(DEFAULT_PENSION_PERCENTAGE);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState<string | null>(null);
  const [adjustErrorMsg, setAdjustErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setCurrentItem(item);
    if (item) {
      const indexer = parsePensionIndexerTag(item.description);
      if (indexer.isIndexed) {
        if (indexer.percentage) setAdjustPercentage(indexer.percentage);
        if (indexer.baseWageCents) setAdjustWage(indexer.baseWageCents / 100);
      }
    }
  }, [item]);

  if (!isOpen || !currentItem) return null;

  const isPension = isPensionItem(currentItem.title, currentItem.description);
  const indexerInfo = parsePensionIndexerTag(currentItem.description);
  const pendingInstallments = currentItem.installments.filter(
    (i) => i.status === "SCHEDULED" || i.status === "OVERDUE"
  );

  const handleDelete = async () => {
    if (confirm(`Tem certeza que deseja excluir permanentemente a conta "${currentItem.title}"?`)) {
      if (onDelete) {
        onDelete(currentItem);
      } else {
        const { deleteFinancialItem } = await import("@/server/actions/financial-items");
        const result = await deleteFinancialItem(currentItem.id);
        if (!result.success) throw new Error(result.error || "Falha ao excluir conta.");
      }
      onClose();
    }
  };

  const handleApplyWageAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustWage <= 0 || adjustPercentage <= 0) {
      setAdjustErrorMsg("Informe valores válidos para o salário mínimo e percentual.");
      return;
    }

    setIsAdjusting(true);
    setAdjustErrorMsg(null);
    setAdjustSuccessMsg(null);

    try {
      const res = await adjustPensionMinimumWage({
        financialItemId: currentItem.id,
        newMinimumWageCents: Math.round(adjustWage * 100),
        percentage: adjustPercentage,
      });

      if (res.success && "newInstallmentAmountCents" in res && typeof res.newInstallmentAmountCents === "number") {
        const updatedAmountCents = BigInt(res.newInstallmentAmountCents);
        const updatedInstallments = currentItem.installments.map((inst) => {
          if (inst.status === "SCHEDULED" || inst.status === "OVERDUE") {
            return { ...inst, amountCents: Number(updatedAmountCents) };
          }
          return inst;
        });

        const newTotalCents = updatedInstallments.reduce((acc, curr) => acc + curr.amountCents, 0);

        setCurrentItem({
          ...currentItem,
          totalAmountCents: newTotalCents,
          installments: updatedInstallments as any,
        });

        notifyStoreChange();
        setAdjustSuccessMsg(
          `Sucesso! ${res.updatedCount} parcela(s) futura(s) reajustada(s) para R$ ${(res.newInstallmentAmountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
        );

        setTimeout(() => {
          setIsAdjustModalOpen(false);
          setAdjustSuccessMsg(null);
        }, 1800);
      } else {
        setAdjustErrorMsg("error" in res && res.error ? String(res.error) : "Erro ao aplicar reajuste.");
      }
    } catch (err: any) {
      setAdjustErrorMsg(err.message || "Erro ao comunicar com o servidor.");
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md border-l border-novex-border bg-novex-surface1 p-6 text-novex-text-primary shadow-2xl overflow-y-auto flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-novex-border pb-4 mb-6">
              <div>
                <span className="text-[10px] font-semibold tracking-wider text-novex-cyan uppercase">
                  {currentItem.direction === "PAYABLE" ? "Conta a Pagar" : "Conta a Receber"}
                </span>
                <h2 className="text-xl font-bold text-novex-text-primary mt-0.5">{currentItem.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-novex-text-muted hover:bg-novex-surface2 hover:text-novex-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Valor Total e Status */}
              <div className="rounded-xl border border-novex-border bg-novex-surface2/60 p-4">
                <span className="text-xs text-novex-text-muted">Valor Total da Obrigação</span>
                <div className="text-3xl font-bold text-novex-text-primary mt-1">
                  {formatCurrency(currentItem.totalAmountCents)}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-novex-text-secondary">
                    Tipo: {currentItem.kind === "RECURRING" ? "Recorrente" : currentItem.kind === "INSTALLMENT_PLAN" ? "Parcelado" : "Avulso"}
                  </span>
                  <StatusBadge status={currentItem.installments[0]?.status || "ACTIVE"} />
                </div>
              </div>

              {/* Informações Principais */}
              <div className="space-y-3 rounded-lg border border-novex-border p-4 bg-novex-surface1">
                <div className="flex items-center gap-3 text-xs">
                  <User className="h-4 w-4 text-novex-text-muted" />
                  <span className="text-novex-text-secondary">Contato / Favorecido:</span>
                  <strong className="text-novex-text-primary ml-auto">{currentItem.contact?.name || "Não especificado"}</strong>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <Tag className="h-4 w-4 text-novex-text-muted" />
                  <span className="text-novex-text-secondary">Categoria:</span>
                  <span
                    className="ml-auto px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                    style={{ backgroundColor: currentItem.categoryColor || "#3B82F6" }}
                  >
                    {currentItem.category}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <Calendar className="h-4 w-4 text-novex-text-muted" />
                  <span className="text-novex-text-secondary">Data Inicial:</span>
                  <strong className="text-novex-text-primary ml-auto">{formatDate(currentItem.startDate)}</strong>
                </div>

                {currentItem.description && (
                  <div className="pt-2 border-t border-novex-border/60 text-xs">
                    <span className="text-novex-text-muted block mb-1">Descrição / Observações:</span>
                    <p className="text-novex-text-secondary italic">
                      {currentItem.description.replace(/\[INDEXER:MINIMUM_WAGE;PERCENT:[0-9.]+;BASE_WAGE:[0-9]+\]/g, "").trim() || currentItem.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Exclusivo: Indexação de Pensão Alimentícia */}
              {isPension && currentItem.direction === "PAYABLE" && (
                <div className="rounded-xl border border-novex-cyan/40 bg-novex-surface2/80 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-novex-cyan" />
                      <span className="font-bold text-xs text-novex-cyan uppercase tracking-wider">
                        Indexada ao Salário Mínimo
                      </span>
                    </div>
                    <span className="bg-novex-cyan/20 text-novex-cyan font-bold px-2 py-0.5 rounded text-[11px]">
                      {indexerInfo.percentage || adjustPercentage}% do Mínimo
                    </span>
                  </div>

                  <p className="text-[11px] text-novex-text-muted leading-relaxed">
                    Pensão alimentícia atrelada ao piso nacional. Ao ocorrer reajuste anual pelo governo, você pode reajustar em lote as parcelas futuras em aberto.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustErrorMsg(null);
                      setAdjustSuccessMsg(null);
                      setIsAdjustModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-novex-surface1 hover:bg-novex-border border border-novex-cyan/50 text-novex-cyan font-semibold py-2 text-xs transition-colors shadow-sm"
                  >
                    <Scale className="h-3.5 w-3.5" />
                    <span>Reajustar Salário Mínimo das Parcelas Futuras</span>
                  </button>
                </div>
              )}

              {/* Lista de Parcelas */}
              <div>
                <h3 className="text-sm font-semibold text-novex-text-primary mb-3 flex items-center justify-between">
                  <span>Parcelas e Vencimentos</span>
                  <span className="text-xs text-novex-text-muted">({currentItem.installments.length} parcela(s))</span>
                </h3>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {currentItem.installments.map((inst) => (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between rounded-lg border border-novex-border bg-novex-surface2/50 p-3 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-novex-text-primary">
                          Parcela {inst.sequence}/{inst.totalSequences || currentItem.installments.length} — {formatCurrency(inst.amountCents)}
                        </div>
                        <div className="text-[11px] text-novex-text-muted mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Vencimento: {formatDate(inst.dueDate)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge status={inst.status} />
                        {inst.status !== "SETTLED" && onPayClick && (
                          <button
                            onClick={() => onPayClick(inst)}
                            className="rounded bg-novex-cyan px-2.5 py-1 text-[11px] font-semibold text-novex-bg hover:bg-novex-cyan-hover"
                          >
                            Pagar Pix
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anexos */}
              <div className="border-t border-novex-border pt-4">
                <h3 className="text-sm font-semibold text-novex-text-primary mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-novex-cyan" />
                  <span>Anexos e Comprovantes</span>
                </h3>
                {currentItem.attachmentsCount > 0 ? (
                  <div className="rounded-lg border border-novex-border bg-novex-surface2/40 p-3 text-xs flex items-center justify-between">
                    <span className="text-novex-text-secondary">comprovante_pagamento.pdf</span>
                    <span className="text-[10px] text-novex-text-muted">245 KB</span>
                  </div>
                ) : (
                  <p className="text-xs text-novex-text-muted italic">Nenhum anexo enviado.</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-novex-border pt-4 mt-6">
            <button
              onClick={handleDelete}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Excluir Esta Conta</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Reajuste de Salário Mínimo */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-novex-border pb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-novex-cyan" />
                <h3 className="font-bold text-sm text-novex-text-primary">
                  Reajustar Pensão por Salário Mínimo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-novex-text-muted hover:text-white p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-novex-text-secondary leading-relaxed">
              Informe o novo valor do salário mínimo fixado pelo governo e o percentual. O sistema recalculará apenas as <strong>{pendingInstallments.length} parcelas futuras em aberto</strong>, preservando as já quitadas no passado.
            </p>

            {adjustErrorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-500/20 p-2.5 text-xs text-rose-300 border border-rose-500/40">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{adjustErrorMsg}</span>
              </div>
            )}

            {adjustSuccessMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/20 p-2.5 text-xs text-emerald-300 border border-emerald-500/40">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{adjustSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleApplyWageAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-novex-text-muted block mb-1">Novo Salário Mínimo Vigente (R$)</label>
                <input
                  type="number"
                  step="1"
                  value={adjustWage}
                  onChange={(e) => setAdjustWage(Number(e.target.value))}
                  required
                  className="w-full rounded-lg border border-novex-border bg-novex-bg p-2 font-mono font-bold text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-novex-text-muted block mb-1">Percentual da Pensão (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={adjustPercentage}
                  onChange={(e) => setAdjustPercentage(Number(e.target.value))}
                  required
                  className="w-full rounded-lg border border-novex-border bg-novex-bg p-2 font-mono font-bold text-novex-cyan focus:border-novex-cyan focus:outline-none"
                />
              </div>

              <div className="rounded-lg border border-novex-border bg-novex-surface2/60 p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-novex-text-muted block uppercase font-mono">Nova Parcela Estimada</span>
                  <span className="font-bold font-mono text-base text-emerald-400">
                    R$ {(adjustWage * (adjustPercentage / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-novex-text-muted block">Parcelas a Atualizar</span>
                  <span className="font-bold text-xs text-novex-text-primary">
                    {pendingInstallments.length} futuras
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-novex-border text-novex-text-secondary hover:bg-novex-surface2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAdjusting}
                  className="px-4 py-1.5 rounded-lg bg-novex-cyan text-novex-bg font-bold hover:bg-novex-cyan/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isAdjusting ? "Aplicando Reajuste..." : "Aplicar às Parcelas Futuras"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
