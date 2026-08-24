"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaymentDialog } from "@/components/ui/PaymentDialog";
import { AccountDetailsDrawer } from "@/components/ui/AccountDetailsDrawer";
import { NewAccountModal } from "@/components/ui/NewAccountModal";
import {
  Search,
  Filter,
  Plus,
  QrCode,
  Eye,
  Trash2,
  Paperclip,
  ArrowUpRight,
  CheckCircle2,
  Edit3,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { FinancialItemMock, InstallmentMock } from "@/types";

export default function ContasAPagarPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<FinancialItemMock | null>(null);
  const [paymentInstallment, setPaymentInstallment] = useState<InstallmentMock | null>(null);
  const [paymentAccountTitle, setPaymentAccountTitle] = useState("");
  const [paymentPixKey, setPaymentPixKey] = useState<string | undefined>();
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinancialItemMock | null>(null);
  const [payablesList, setPayablesList] = useState<FinancialItemMock[]>([]);

  const loadItems = async () => {
    const { getFinancialItems } = await import("@/server/actions/financial-items");
    const items = await getFinancialItems("PAYABLE");
    setPayablesList(items as unknown as FinancialItemMock[]);
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

      {/* Tabela de Contas a Pagar */}
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
              {filteredPayables.map((item) => {
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
                    <td className="py-4 px-4 font-bold text-novex-text-primary">
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
                          onClick={() => {
                            setEditingItem(item);
                            setIsNewModalOpen(true);
                          }}
                          className="rounded p-1.5 text-novex-text-muted hover:bg-novex-surface2 hover:text-novex-cyan transition-colors"
                          title="Editar conta"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setSelectedDrawerItem(item)}
                          className="rounded p-1.5 text-novex-text-muted hover:bg-novex-surface2 hover:text-novex-text-primary transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {inst && inst.status !== "SETTLED" && (
                          <button
                            onClick={() => {
                              setPaymentAccountTitle(item.title);
                              setPaymentPixKey(item.pixKey);
                              setPaymentInstallment(inst);
                            }}
                            className="rounded bg-novex-cyan/10 px-2.5 py-1.5 text-[11px] font-bold text-novex-cyan hover:bg-novex-cyan/20 transition-colors flex items-center gap-1.5"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            <span>Pagar</span>
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (confirm(`Tem certeza que deseja excluir permanentemente a conta "${item.title}"?`)) {
                              const { deleteFinancialItem } = await import("@/server/actions/financial-items");
                              await deleteFinancialItem(item.id);
                              const { notifyStoreChange } = await import("@/services/financial-store");
                              notifyStoreChange();
                            }
                          }}
                          className="rounded p-1.5 text-novex-text-muted hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          title="Excluir conta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais e Drawers */}
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
        onDelete={async (targetItem) => {
          const { deleteFinancialItem } = await import("@/server/actions/financial-items");
          await deleteFinancialItem(targetItem.id);
          const { notifyStoreChange } = await import("@/services/financial-store");
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
      />
    </div>
  );
}
