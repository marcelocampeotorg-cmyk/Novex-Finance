"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReceivablePixChargeModal } from "@/components/modals/ReceivablePixChargeModal";
import { ManualSettlementModal } from "@/components/modals/ManualSettlementModal";
import { NewAccountModal } from "@/components/ui/NewAccountModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
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
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { FinancialItemDTO, InstallmentDTO } from "@/types";
import { subscribeFinancialStore, notifyStoreChange } from "@/services/financial-store";
import { getFinancialItems, deleteFinancialItem } from "@/server/actions/financial-items";

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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<FinancialItemDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadItems = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const items = await getFinancialItems("RECEIVABLE");
      setReceivablesList(items as unknown as FinancialItemDTO[]);
    } catch (err: any) {
      console.error("Falha ao carregar contas a receber:", err);
      setErrorMsg(err?.message || "Não foi possível carregar as contas a receber.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    const unsubscribe = subscribeFinancialStore(() => {
      loadItems();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const res = await deleteFinancialItem(deletingItem.id);
      if (!res.success) {
        throw new Error(res.error || "Falha ao mover recebível para a lixeira.");
      }
      notifyStoreChange();
      setDeletingItem(null);
    } catch (err: any) {
      console.error("Erro ao excluir recebível:", err);
      setErrorMsg(err?.message || "Falha ao mover recebível para a lixeira.");
    } finally {
      setIsDeleting(false);
    }
  };

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
        description="Cobranças Pix oficiais via Mercado Pago Orders API, baixas de recebimento e gestão de devedores."
        actions={
          <button
            onClick={() => {
              setEditingItem(null);
              setIsNewModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Novo Recebível</span>
          </button>
        }
      />

      {/* Banner de Erro Resiliente */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => loadItems()}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/30 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      {/* Cards de Métricas em Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* A Receber (Pendente) */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-5 space-y-3 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-novex-text-secondary uppercase tracking-wider">
              A Receber (Em Aberto)
            </span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-novex-text-primary">
              {formatCurrency(totalPendingCents)}
            </div>
            <div className="text-[11px] text-novex-text-muted mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-emerald-400">{pendingCount} conta(s)</span>
              <span>aguardando liquidação</span>
            </div>
          </div>
        </div>

        {/* Total Recebido / Quitado */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-5 space-y-3 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-novex-text-secondary uppercase tracking-wider">
              Total Quitado / Recebido
            </span>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatCurrency(totalSettledCents)}
            </div>
            <div className="text-[11px] text-novex-text-muted mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-novex-text-primary">{settledCount} conta(s)</span>
              <span>com baixa integral ou parcial</span>
            </div>
          </div>
        </div>

        {/* Em Atraso (Vencidas) */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-5 space-y-3 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-novex-text-secondary uppercase tracking-wider">
              Recebíveis Vencidos
            </span>
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${totalOverdueCents > 0 ? "text-rose-400" : "text-novex-text-primary"}`}>
              {formatCurrency(totalOverdueCents)}
            </div>
            <div className="text-[11px] text-novex-text-muted mt-1">
              {totalOverdueCents > 0 ? (
                <span className="text-rose-400 font-medium">Requer cobrança imediata via WhatsApp</span>
              ) : (
                <span>Nenhum recebível em atraso</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-novex-border bg-novex-surface1 p-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por cliente, título ou categoria..."
            className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 pl-9 pr-4 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Tabs de Filtro de Status */}
        <div className="flex items-center gap-1.5 p-1 bg-novex-bg border border-novex-border rounded-lg self-stretch sm:self-auto justify-center">
          <button
            onClick={() => setStatusFilter("PENDING")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "PENDING"
                ? "bg-emerald-500 text-white shadow-xs"
                : "text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2"
            }`}
          >
            <span>Pendentes</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusFilter === "PENDING" ? "bg-white/20 text-white" : "bg-novex-surface2 text-novex-text-muted"
            }`}>
              {pendingCount}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter("SETTLED")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "SETTLED"
                ? "bg-emerald-500 text-white shadow-xs"
                : "text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2"
            }`}
          >
            <span>Quitadas</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusFilter === "SETTLED" ? "bg-white/20 text-white" : "bg-novex-surface2 text-novex-text-muted"
            }`}>
              {settledCount}
            </span>
          </button>

          <button
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

      {/* Lista de Recebíveis com Skeleton e Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={`skeleton-rec-${idx}`}
              className="rounded-xl border border-novex-border bg-novex-surface1 p-5 space-y-4 animate-pulse shadow-xs"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-3 bg-novex-surface2 rounded w-20"></div>
                  <div className="h-5 bg-novex-surface2 rounded w-44"></div>
                  <div className="h-3 bg-novex-surface2 rounded w-32"></div>
                </div>
                <div className="h-6 bg-novex-surface2 rounded w-24"></div>
              </div>
              <div className="border-t border-novex-border/60 pt-3 space-y-2">
                <div className="h-10 bg-novex-surface2/50 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredReceivables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-novex-border bg-novex-surface1/50 p-12 text-center shadow-xs">
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
              className={`rounded-xl border p-5 space-y-4 transition-all relative group cursor-pointer shadow-xs ${
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
                        Quitado
                      </span>
                    ) : item.hasOverdue ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                        <AlertTriangle className="h-3 w-3" />
                        Vencido
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        <Clock className="h-3 w-3" />
                        Em Aberto
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-novex-text-primary mt-1 group-hover:text-emerald-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-novex-text-muted flex items-center gap-1.5 mt-0.5">
                    <span>Cliente:</span>
                    <strong className="text-novex-text-secondary">{item.contact?.name || "Consumidor Final"}</strong>
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {item.isFullySettled ? (
                      <span className="text-lg font-bold text-emerald-400/80 line-through">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingItem(item);
                      }}
                      className="p-1 text-novex-text-muted hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
                      title="Mover recebível para lixeira"
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
                          : "bg-novex-surface2/60 border-novex-border/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-novex-text-primary">
                            Parcela {inst.sequence}
                          </span>
                          <span className="text-[10px] text-novex-text-muted">
                            Venc: {formatDate(inst.dueDate)}
                          </span>
                        </div>
                        <StatusBadge status={inst.status} />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-mono font-bold text-novex-text-primary block">
                            {formatCurrency(inst.amountCents)}
                          </span>
                          {inst.settledAmountCents && Number(inst.settledAmountCents) > 0 && !isInstSettled && (
                            <span className="text-[10px] text-emerald-400 block font-mono">
                              Resta: {formatCurrency(instRemaining)}
                            </span>
                          )}
                        </div>

                        {/* Botões de Ação da Parcela */}
                        {!isInstSettled && (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* Baixa Manual */}
                            <button
                              onClick={() => {
                                setManualSettleItemTitle(item.title);
                                setManualSettleDebtorName(item.contact?.name || "Cliente");
                                setManualSettleInstallment(inst);
                              }}
                              className="flex items-center gap-1 rounded bg-novex-surface2 hover:bg-novex-border px-2 py-1 text-[11px] font-semibold text-novex-text-primary transition-colors cursor-pointer shadow-xs"
                              title="Registrar recebimento manual em dinheiro/cédula ou transferência"
                            >
                              <Banknote className="h-3 w-3 text-emerald-400" />
                              <span>Baixar</span>
                            </button>

                            {/* Cobrar Pix / WhatsApp */}
                            <button
                              onClick={() => {
                                setSelectedItemTitle(item.title);
                                setDebtorName(item.contact?.name || "Cliente");
                                setSelectedInstallment(inst);
                              }}
                              className="flex items-center gap-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
                              title="Gerar Cobrança Pix Oficial com QR Code e envio WhatsApp"
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

      {/* Modal Corporativo de Confirmação de Exclusão (Soft Delete) */}
      <ConfirmModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title={`Mover "${deletingItem?.title}" para a Lixeira?`}
        description="Este recebível deixará de ser considerado nos relatórios ativos e na previsão de entradas."
        subNote="O registro não é excluído permanentemente. Você pode restaurá-lo a qualquer momento na Central de Lixeira em até 30 dias."
        confirmText="Mover para Lixeira"
        variant="danger"
      />

      {/* Modal de Liquidação Manual (Dinheiro / Cédula / Outro) */}
      <ManualSettlementModal
        isOpen={!!manualSettleInstallment}
        onClose={() => setManualSettleInstallment(null)}
        onSuccess={async () => {
          await loadItems();
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
