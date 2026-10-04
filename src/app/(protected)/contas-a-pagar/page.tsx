"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaymentDialog } from "@/components/ui/PaymentDialog";
import { ManualSettlementModal } from "@/components/modals/ManualSettlementModal";
import { AccountDetailsDrawer } from "@/components/ui/AccountDetailsDrawer";
import { NewAccountModal } from "@/components/ui/NewAccountModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  Search,
  Filter,
  Plus,
  QrCode,
  Eye,
  Trash2,
  Paperclip,
  Edit3,
  Banknote,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { FinancialItemDTO, InstallmentDTO } from "@/types";
import { subscribeFinancialStore, notifyStoreChange } from "@/services/financial-store";
import { getFinancialItems, deleteFinancialItem } from "@/server/actions/financial-items";

export default function ContasAPagarPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<FinancialItemDTO | null>(null);
  const [paymentInstallment, setPaymentInstallment] = useState<InstallmentDTO | null>(null);
  const [paymentAccountTitle, setPaymentAccountTitle] = useState("");
  const [paymentPixKey, setPaymentPixKey] = useState<string | undefined>();
  const [manualSettleInstallment, setManualSettleInstallment] = useState<InstallmentDTO | null>(null);
  const [manualSettleAccountTitle, setManualSettleAccountTitle] = useState("");
  const [manualSettlePayeeName, setManualSettlePayeeName] = useState("");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinancialItemDTO | null>(null);
  const [payablesList, setPayablesList] = useState<FinancialItemDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingItem, setDeletingItem] = useState<FinancialItemDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadItems = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const items = await getFinancialItems("PAYABLE");
      setPayablesList(items as unknown as FinancialItemDTO[]);
    } catch (err: any) {
      console.error("Falha ao carregar contas a pagar:", err);
      setErrorMsg(err?.message || "Não foi possível carregar as contas a pagar.");
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
        throw new Error(res.error || "Falha ao mover conta para a lixeira.");
      }
      notifyStoreChange();
      setDeletingItem(null);
    } catch (err: any) {
      console.error("Erro ao excluir conta:", err);
      setErrorMsg(err?.message || "Falha ao mover conta para a lixeira.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredPayables = payablesList.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.contact?.name && item.contact.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "ALL") return matchesSearch;
    const instStatus = item.installments[0]?.status;
    return matchesSearch && instStatus === statusFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Contas a Pagar"
        description="Gerenciamento de obrigações financeiras, vencimentos, parcelas e pagamento Pix via Mercado Pago."
        actions={
          <button
            onClick={() => {
              setEditingItem(null);
              setIsNewModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-novex-cyan px-4 py-2 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover transition-colors shadow-sm glow-cyan-subtle"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Nova Conta a Pagar</span>
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

      {/* Barra de Filtros e Pesquisa */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-novex-border bg-novex-surface1 p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por conta, favorecido ou categoria..."
            className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 pl-9 pr-4 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-novex-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
            >
              <option value="ALL">Todos os Status</option>
              <option value="SCHEDULED">Previstas / A Vencer</option>
              <option value="OVERDUE">Vencidas</option>
              <option value="SETTLED">Pagas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Contas a Pagar com Skeleton e Empty State */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-novex-border bg-novex-surface2/60 text-novex-text-muted uppercase text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Conta / Título</th>
                <th className="py-3.5 px-4">Favorecido</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Valor Total</th>
                <th className="py-3.5 px-4">Parcelas</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-novex-border/60">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-4 px-4">
                      <div className="h-3.5 bg-novex-surface2 rounded w-36 mb-1.5"></div>
                      <div className="h-2.5 bg-novex-surface2/50 rounded w-24"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3.5 bg-novex-surface2 rounded w-28"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-novex-surface2 rounded w-20"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3.5 bg-novex-surface2 rounded w-20"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-novex-surface2 rounded w-24"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-3.5 bg-novex-surface2 rounded w-16"></div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-novex-surface2 rounded w-20"></div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-7 bg-novex-surface2 rounded w-24 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : filteredPayables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="rounded-full bg-novex-surface2 p-3 text-novex-text-muted">
                        <Banknote className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-novex-text-primary">
                          {searchTerm || statusFilter !== "ALL"
                            ? "Nenhuma conta a pagar encontrada para os filtros atuais."
                            : "Nenhuma conta a pagar cadastrada no período."}
                        </p>
                        <p className="text-[11px] text-novex-text-muted">
                          {searchTerm || statusFilter !== "ALL"
                            ? "Tente ajustar a busca ou limpar os filtros de status."
                            : "Cadastre novas obrigações para acompanhar vencimentos e gerar pagamentos Pix."}
                        </p>
                      </div>
                      {searchTerm || statusFilter !== "ALL" ? (
                        <button
                          onClick={() => {
                            setSearchTerm("");
                            setStatusFilter("ALL");
                          }}
                          className="mt-2 text-xs font-semibold text-novex-cyan hover:underline"
                        >
                          Limpar Filtros
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingItem(null);
                            setIsNewModalOpen(true);
                          }}
                          className="mt-2 flex items-center gap-1.5 rounded-lg bg-novex-cyan/10 px-3 py-1.5 text-xs font-semibold text-novex-cyan hover:bg-novex-cyan/20 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Cadastrar Primeira Conta</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayables.map((item) => {
                  const inst = item.installments[0];
                  return (
                    <tr
                      key={item.id}
                      onDoubleClick={() => {
                        setEditingItem(item);
                        setIsNewModalOpen(true);
                      }}
                      title="Clique 2 vezes para editar a conta"
                      className="hover:bg-novex-surface2/40 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-4">
                        <div className="font-semibold text-novex-text-primary flex items-center gap-2">
                          <span>{item.title}</span>
                          {item.attachmentsCount > 0 && (
                            <Paperclip className="h-3.5 w-3.5 text-novex-cyan" />
                          )}
                        </div>
                        {item.description && (
                          <div className="text-[10px] text-novex-text-muted truncate max-w-xs">{item.description}</div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-novex-text-secondary font-medium">
                        {item.contact?.name || "Não informado"}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className="px-2.5 py-1 rounded-md text-[10px] font-semibold text-white inline-block"
                          style={{ backgroundColor: item.categoryColor }}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-novex-text-secondary font-medium">
                        {formatDate(inst?.dueDate || item.startDate)}
                      </td>
                      <td className="py-4 px-4 font-bold text-red-400 font-mono">
                        {formatCurrency(item.totalAmountCents)}
                      </td>
                      <td className="py-4 px-4 text-novex-text-muted">
                        {item.kind === "INSTALLMENT_PLAN"
                          ? `${item.installments.length}x`
                          : item.kind === "RECURRING"
                          ? "Recorrente"
                          : "Avulsa"}
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={inst?.status || "ACTIVE"} />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingItem(item);
                              setIsNewModalOpen(true);
                            }}
                            className="rounded p-1.5 text-novex-text-muted hover:bg-novex-surface2 hover:text-novex-cyan transition-colors"
                            title="Editar conta"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDrawerItem(item);
                            }}
                            className="rounded p-1.5 text-novex-text-muted hover:bg-novex-surface2 hover:text-novex-text-primary transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {inst && inst.status !== "SETTLED" && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setManualSettleAccountTitle(item.title);
                                  setManualSettlePayeeName(item.contact?.name || "Favorecido");
                                  setManualSettleInstallment(inst);
                                }}
                                className="rounded bg-novex-surface2 hover:bg-novex-border px-2.5 py-1.5 text-[11px] font-semibold text-novex-text-primary transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                                title="Registrar pagamento manual em dinheiro/cédula, Pix ou transferência"
                              >
                                <Banknote className="h-3.5 w-3.5 text-novex-cyan" />
                                <span>Baixar</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPaymentAccountTitle(item.title);
                                  setPaymentPixKey(item.pixKey);
                                  setPaymentInstallment(inst);
                                }}
                                className="rounded bg-novex-cyan/10 px-2.5 py-1.5 text-[11px] font-bold text-novex-cyan hover:bg-novex-cyan/20 transition-colors flex items-center gap-1.5"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                <span>Pagar</span>
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingItem(item);
                            }}
                            className="rounded p-1.5 text-novex-text-muted hover:bg-red-500/20 hover:text-red-400 transition-colors"
                            title="Mover para lixeira"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Corporativo de Confirmação de Exclusão (Soft Delete) */}
      <ConfirmModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title={`Mover "${deletingItem?.title}" para a Lixeira?`}
        description="Esta obrigação financeira deixará de ser exibida nas listas ativas e no cálculo de obrigações previstas."
        subNote="O registro não é excluído permanentemente. Você pode restaurá-lo a qualquer momento na Central de Lixeira em até 30 dias."
        confirmText="Mover para Lixeira"
        variant="danger"
      />

      {/* Modais e Drawers */}
      <ManualSettlementModal
        isOpen={!!manualSettleInstallment}
        onClose={() => setManualSettleInstallment(null)}
        onSuccess={() => loadItems()}
        installment={manualSettleInstallment}
        itemTitle={manualSettleAccountTitle}
        contactName={manualSettlePayeeName}
        direction="PAYABLE"
      />

      <PaymentDialog
        isOpen={!!paymentInstallment}
        onClose={() => setPaymentInstallment(null)}
        installment={paymentInstallment}
        accountTitle={paymentAccountTitle}
        pixKey={paymentPixKey}
      />

      <AccountDetailsDrawer
        isOpen={!!selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
        item={selectedDrawerItem}
        onPayClick={(inst) => {
          setSelectedDrawerItem(null);
          setPaymentAccountTitle(selectedDrawerItem?.title || "");
          setPaymentPixKey(selectedDrawerItem?.pixKey || undefined);
          setPaymentInstallment(inst);
        }}
        onSettleClick={(inst) => {
          setSelectedDrawerItem(null);
          setManualSettleAccountTitle(selectedDrawerItem?.title || "");
          setManualSettlePayeeName(selectedDrawerItem?.contact?.name || "Favorecido");
          setManualSettleInstallment(inst);
        }}
        onDelete={async (targetItem) => {
          await deleteFinancialItem(targetItem.id);
          notifyStoreChange();
          setSelectedDrawerItem(null);
        }}
      />

      <NewAccountModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setEditingItem(null);
        }}
        editItem={editingItem}
        defaultDirection="PAYABLE"
        lockDirection={true}
      />
    </div>
  );
}
