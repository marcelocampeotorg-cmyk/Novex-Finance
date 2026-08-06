"use client";

import React from "react";
import { X, Calendar, User, Tag, Paperclip, CreditCard, History, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FinancialItemMock } from "@/types";

interface AccountDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: FinancialItemMock | null;
  onPayClick?: (installment: any) => void;
}

export const AccountDetailsDrawer: React.FC<AccountDetailsDrawerProps> = ({
  isOpen,
  onClose,
  item,
  onPayClick,
}) => {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md border-l border-novex-border bg-novex-surface1 p-6 text-novex-text-primary shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-novex-border pb-4 mb-6">
            <div>
              <span className="text-[10px] font-semibold tracking-wider text-novex-cyan uppercase">
                {item.direction === "PAYABLE" ? "Conta a Pagar" : "Conta a Receber"}
              </span>
              <h2 className="text-xl font-bold text-novex-text-primary mt-0.5">{item.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-novex-text-muted hover:bg-novex-surface2 hover:text-novex-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Valor Total e Status */}
            <div className="rounded-xl border border-novex-border bg-novex-surface2/60 p-4">
              <span className="text-xs text-novex-text-muted">Valor Total da Obrigação</span>
              <div className="text-3xl font-bold text-novex-text-primary mt-1">
                {formatCurrency(item.totalAmountCents)}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-novex-text-secondary">Tipo: {item.kind === "RECURRING" ? "Recorrente" : item.kind === "INSTALLMENT_PLAN" ? "Parcelado" : "Avulso"}</span>
                <StatusBadge status={item.installments[0]?.status || "ACTIVE"} />
              </div>
            </div>

            {/* Informações Principais */}
            <div className="space-y-3 rounded-lg border border-novex-border p-4 bg-novex-surface1">
              <div className="flex items-center gap-3 text-xs">
                <User className="h-4 w-4 text-novex-text-muted" />
                <span className="text-novex-text-secondary">Contato / Favorecido:</span>
                <strong className="text-novex-text-primary ml-auto">{item.contact?.name || "Não especificado"}</strong>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <Tag className="h-4 w-4 text-novex-text-muted" />
                <span className="text-novex-text-secondary">Categoria:</span>
                <span
                  className="ml-auto px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                  style={{ backgroundColor: item.categoryColor || "#3B82F6" }}
                >
                  {item.category}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <Calendar className="h-4 w-4 text-novex-text-muted" />
                <span className="text-novex-text-secondary">Data Inicial:</span>
                <strong className="text-novex-text-primary ml-auto">{formatDate(item.startDate)}</strong>
              </div>

              {item.description && (
                <div className="pt-2 border-t border-novex-border/60 text-xs">
                  <span className="text-novex-text-muted block mb-1">Descrição / Observações:</span>
                  <p className="text-novex-text-secondary italic">{item.description}</p>
                </div>
              )}
            </div>

            {/* Lista de Parcelas */}
            <div>
              <h3 className="text-sm font-semibold text-novex-text-primary mb-3 flex items-center justify-between">
                <span>Parcelas e Vencimentos</span>
                <span className="text-xs text-novex-text-muted">({item.installments.length} parcela(s))</span>
              </h3>

              <div className="space-y-2">
                {item.installments.map((inst) => (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between rounded-lg border border-novex-border bg-novex-surface2/50 p-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-novex-text-primary">
                        Parcela {inst.sequence}/{inst.totalSequences} — {formatCurrency(inst.amountCents)}
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
              {item.attachmentsCount > 0 ? (
                <div className="rounded-lg border border-novex-border bg-novex-surface2/40 p-3 text-xs flex items-center justify-between">
                  <span className="text-novex-text-secondary">comprovante_pagamento.pdf</span>
                  <span className="text-[10px] text-novex-text-muted">245 KB</span>
                </div>
              ) : (
                <p className="text-xs text-novex-text-muted italic">Nenhum anexo enviado.</p>
              )}
            </div>

            {/* Histórico Demonstrativo */}
            <div className="border-t border-novex-border pt-4">
              <h3 className="text-sm font-semibold text-novex-text-primary mb-2 flex items-center gap-2">
                <History className="h-4 w-4 text-novex-cyan" />
                <span>Histórico de Auditoria</span>
              </h3>
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center justify-between text-novex-text-muted">
                  <span>Conta criada no sistema</span>
                  <span>{formatDate(item.startDate)}</span>
                </div>
                {item.installments.some((i) => i.status === "SETTLED") && (
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Parcela conciliada via Mercado Pago
                    </span>
                    <span>Recentemente</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
