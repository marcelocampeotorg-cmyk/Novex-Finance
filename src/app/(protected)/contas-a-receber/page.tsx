"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReceivablePixChargeModal } from "@/components/modals/ReceivablePixChargeModal";
import { ManualSettlementModal } from "@/components/modals/ManualSettlementModal";
import { NewAccountModal } from "@/components/ui/NewAccountModal";
import {
  Search,
  Plus,
  QrCode,
  ArrowDownLeft,
  Trash2,
  Edit3,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Clock,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { FinancialItemDTO, InstallmentDTO } from "@/types";

export default function ContasAReceberPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "SETTLED" | "ALL">("PENDING");
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentDTO | null>(null);
  const [selectedItemTitle, setSelectedItemTitle] = useState("");
  const [debtorName, setDebtorName] = useState("");
  const [manualSettleInstallment, setManualSettleInstallment] = useState<InstallmentDTO | null>(null);
  const [manualSettleItemTitle, setManualSettleItemTitle] = useState("");
  const [manualSettleDebtorName, setManualSettleDebtorName] = useState("");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinancialItemDTO | null>(null);
  const [receivablesList, setReceivablesList] = useState<FinancialItemDTO[]>([]);

  const loadItems = async () => {
    const { getFinancialItems } = await import("@/server/actions/financial-items");
    const items = await getFinancialItems("RECEIVABLE");
    setReceivablesList(items as unknown as FinancialItemDTO[]);
  };

  useEffect(() => {
    loadItems();
    import("@/services/financial-store").then(({ subscribeFinancialStore }) => {
      const unsubscribe = subscribeFinancialStore(() => {
        loadItems();
      });
      return () => unsubscribe();
    });
  }, []);

  const now = new Date();
  let totalPendingCents = 0;
  let totalSettledCents = 0;
  let totalOverdueCents = 0;
  let pendingCount = 0;
  let settledCount = 0;

  const augmentedList = receivablesList.map((item) => {
    const totalAmount = Number(item.totalAmountCents);
    const settledAmount = item.installments.reduce(
      (acc, inst) => acc + Number(inst.settledAmountCents || 0),
      0
    );
    const remainingAmount = Math.max(0, totalAmount - settledAmount);
    const isFullySettled =
      item.status === "COMPLETED" ||
      (item.installments.length > 0 &&
        item.installments.every(
          (i) => i.status === "SETTLED" || Number(i.amountCents) - Number(i.settledAmountCents || 0) <= 0
        ));
    const hasOverdue = item.installments.some(
      (i) => i.status !== "SETTLED" && i.status !== "CANCELED" && new Date(i.dueDate) < now
    );

    if (isFullySettled) {
      settledCount++;
    } else {
      pendingCount++;
      totalPendingCents += remainingAmount;
    }
    totalSettledCents += settledAmount;

    if (hasOverdue && !isFullySettled) {
      const overdueAmount = item.installments
        .filter((i) => i.status !== "SETTLED" && i.status !== "CANCELED" && new Date(i.dueDate) < now)
        .reduce((acc, i) => acc + Math.max(0, Number(i.amountCents) - Number(i.settledAmountCents || 0)), 0);
      totalOverdueCents += overdueAmount;
    }

    return {
      ...item,
      totalAmount,
      settledAmount,
      remainingAmount,
      isFullySettled,
      hasOverdue,
    };
  });

  const filteredReceivables = augmentedList.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.contact?.name && item.contact.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "PENDING") {
      return !item.isFullySettled;
    }
    if (statusFilter === "SETTLED") {
      return item.isFullySettled;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Contas a Receber"
        description="Cobranças Pix Mercado Pago Orders, controle de entradas previstas e acertos de devedores."
        actions={
          <button
            onClick={() => {
              setEditingItem(null);
              setIsNewModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Nova Conta a Receber</span>
          </button>
        }
      />

      {/* Cards de Resumo Rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-medium text-novex-text-muted block">Total a Receber (Pendente)</span>
            <span className="text-xl font-extrabold text-emerald-400 mt-0.5 block">
              {formatCurrency(totalPendingCents)}
            </span>
            <span className="text-[11px] text-novex-text-muted mt-0.5 block">
              {pendingCount} conta(s) em aberto
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-medium text-novex-text-muted block">Total Já Recebido (Baixado)</span>
            <span className="text-xl font-extrabold text-novex-text-primary mt-0.5 block">
              {formatCurrency(totalSettledCents)}
            </span>
            <span className="text-[11px] text-emerald-400 mt-0.5 block">
              {settledCount} conta(s) 100% quitada(s)
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-novex-cyan/10 border border-novex-cyan/30 flex items-center justify-center text-novex-cyan">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-medium text-novex-text-muted block">Em Atraso</span>
            <span className={`text-xl font-extrabold mt-0.5 block ${totalOverdueCents > 0 ? "text-red-400" : "text-novex-text-muted"}`}>
              {formatCurrency(totalOverdueCents)}
            </span>
            <span className="text-[11px] text-novex-text-muted mt-0.5 block">
              {totalOverdueCents > 0 ? "Exige atenção ou cobrança" : "Nenhum atraso pendente"}
            </span>
          </div>
          <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${totalOverdueCents > 0 ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-novex-surface2/60 border-novex-border text-novex-text-muted"}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros de Status */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-novex-border bg-novex-surface1 p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar direito a receber por projeto ou cliente..."
            className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 pl-9 pr-4 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none"
          />
        </div>

        {/* Abas de Filtragem de Status */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-novex-bg border border-novex-border w-full sm:w-auto justify-center sm:justify-start">
          <button
            type="button"
            onClick={() => setStatusFilter("PENDING")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "PENDING"
                ? "bg-emerald-500 text-white shadow-xs"
                : "text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2"
            }`}
          >
            <span>A Receber</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusFilter === "PENDING" ? "bg-white/20 text-white" : "bg-novex-surface2 text-novex-text-muted"
            }`}>
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("SETTLED")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "SETTLED"
                ? "bg-emerald-500 text-white shadow-xs"
                : "text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2"
            }`}
          >
            <span>Recebidas</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusFilter === "SETTLED" ? "bg-white/20 text-white" : "bg-novex-surface2 text-novex-text-muted"
            }`}>
              {settledCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-emerald-500 text-white shadow-xs"
                : "text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2"
            }`}
          >
            <span>Todas</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusFilter === "ALL" ? "bg-white/20 text-white" : "bg-novex-surface2 text-novex-text-muted"
            }`}>
              {augmentedList.length}
            </span>
          </button>
        </div>
      </div>

      {/* Lista de Recebíveis */}
      {filteredReceivables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-novex-border bg-novex-surface1/50 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
            {statusFilter === "PENDING" ? <CheckCircle2 className="h-6 w-6" /> : <Wallet className="h-6 w-6" />}
          </div>
          <h4 className="text-sm font-bold text-novex-text-primary">
            {statusFilter === "PENDING"
              ? "Tudo em dia! Nenhuma conta a receber pendente."
              : statusFilter === "SETTLED"
              ? "Nenhuma conta recebida/quitada cadastrada."
              : "Nenhum registro de conta a receber encontrado."}
          </h4>
          <p className="text-xs text-novex-text-muted mt-1 max-w-md mx-auto">
            {statusFilter === "PENDING"
              ? "Todas as contas foram baixadas ou não há pendências agendadas no momento."
              : "Lançamentos e baixas manuais ou cobranças Pix concluídas aparecerão aqui."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredReceivables.map((item) => (
            <div
              key={item.id}
              onDoubleClick={() => {
                setEditingItem(item);
                setIsNewModalOpen(true);
              }}
              title="Dar 2 cliques para editar este recebível"
              className={`rounded-xl border p-5 space-y-4 transition-all relative group cursor-pointer ${
                item.isFullySettled
                  ? "border-novex-border bg-novex-surface1/60 opacity-85 hover:opacity-100 hover:border-emerald-500/40"
                  : "border-novex-border bg-novex-surface1 hover:border-emerald-500/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      {item.category}
                    </span>
                    {item.isFullySettled ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" />
                        Quitada
                      </span>
                    ) : item.settledAmount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Parcialmente Paga
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-base font-bold text-novex-text-primary mt-1">{item.title}</h3>
                  <p className="text-xs text-novex-text-muted mt-0.5">{item.contact?.name}</p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    {item.isFullySettled ? (
                      <span className="text-lg font-bold text-novex-text-muted line-through" title="Total original quitado">
                        {formatCurrency(item.totalAmount)}
                      </span>
                    ) : (
                      <span className="text-lg font-bold text-emerald-400" title="Saldo restante a receber">
                        {formatCurrency(item.remainingAmount)}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem(item);
                        setIsNewModalOpen(true);
                      }}
                      className="p-1 text-novex-text-muted hover:bg-emerald-500/20 hover:text-emerald-400 rounded transition-colors"
                      title="Editar recebível"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Tem certeza que deseja excluir permanentemente "${item.title}"?`)) {
                          const { deleteFinancialItem } = await import("@/server/actions/financial-items");
                          await deleteFinancialItem(item.id);
                          const { notifyStoreChange } = await import("@/services/financial-store");
                          notifyStoreChange();
                        }
                      }}
                      className="p-1 text-novex-text-muted hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
                      title="Excluir recebível"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-[10px] text-novex-text-muted block mt-0.5">
                    {item.isFullySettled
                      ? `Quitado em ${item.installments.length} parcela(s)`
                      : item.settledAmount > 0
                      ? `Abatido ${formatCurrency(item.settledAmount)} de ${formatCurrency(item.totalAmount)}`
                      : `${item.installments.length} parcela(s)`}
                  </span>
                </div>
              </div>

              {/* Parcelas */}
              <div className="space-y-2 border-t border-novex-border/60 pt-3">
                <span className="text-[11px] font-semibold text-novex-text-secondary block">
                  Parcelas:
                </span>
                {item.installments.map((inst) => {
                  const instRemaining = Math.max(0, Number(inst.amountCents) - Number(inst.settledAmountCents || 0));
                  const isInstSettled = inst.status === "SETTLED" || instRemaining <= 0;

                  return (
                    <div
                      key={inst.id}
                      className={`flex items-center justify-between rounded-lg p-2.5 text-xs border ${
                        isInstSettled
                          ? "bg-novex-surface2/30 border-novex-border/30 opacity-75"
                          : "bg-novex-surface2/60 border-novex-border/40"
                      }`}
                    >
                      <div>
                        <span className={`font-semibold ${isInstSettled ? "text-novex-text-muted line-through" : "text-emerald-400"}`}>
                          Parcela {inst.sequence}/{inst.totalSequences} — {formatCurrency(inst.amountCents)}
                        </span>
                        <span className="text-[10px] text-novex-text-muted block">
                          Vencimento: {formatDate(inst.dueDate)}
                          {Number(inst.settledAmountCents || 0) > 0 && !isInstSettled && (
                            <span className="text-amber-400 ml-1.5 font-medium">
                              (Abatido: {formatCurrency(Number(inst.settledAmountCents))})
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge status={inst.status} />
                        {!isInstSettled && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setManualSettleItemTitle(item.title);
                                setManualSettleDebtorName(item.contact?.name || "Devedor");
                                setManualSettleInstallment(inst);
                              }}
                              className="flex items-center gap-1 rounded bg-emerald-700/80 hover:bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors cursor-pointer shadow-xs"
                              title="Registrar recebimento manual em dinheiro/cédula, Pix ou transferência"
                            >
                              <Banknote className="h-3 w-3" />
                              <span>Baixar</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedItemTitle(item.title);
                                setDebtorName(item.contact?.name || "Devedor");
                                setSelectedInstallment(inst);
                              }}
                              className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                              title="Cobrar via Pix e WhatsApp (Manual Web ou Bot automático)"
                            >
                              <QrCode className="h-3 w-3" />
                              <span>Cobrar Pix / WhatsApp</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Liquidação Manual (Dinheiro / Cédula / Outro) */}
      <ManualSettlementModal
        isOpen={!!manualSettleInstallment}
        onClose={() => setManualSettleInstallment(null)}
        onSuccess={async () => {
          await loadItems();
          const { notifyStoreChange } = await import("@/services/financial-store");
          notifyStoreChange();
        }}
        installment={manualSettleInstallment}
        itemTitle={manualSettleItemTitle}
        contactName={manualSettleDebtorName}
        direction="RECEIVABLE"
      />

      {/* Modal de Cobrança Pix via Orders API */}
      {selectedInstallment && (
        <ReceivablePixChargeModal
          isOpen={!!selectedInstallment}
          onClose={() => setSelectedInstallment(null)}
          installmentId={selectedInstallment.id}
          amountCents={selectedInstallment.amountCents}
          title={selectedItemTitle || "Cobrança de Recebível"}
          debtorName={debtorName}
          dueDate={selectedInstallment.dueDate}
        />
      )}

      <NewAccountModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setEditingItem(null);
        }}
        editItem={editingItem}
        defaultDirection="RECEIVABLE"
        lockDirection={true}
      />
    </div>
  );
}
