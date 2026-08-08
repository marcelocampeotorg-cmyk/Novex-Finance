"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReceivablePixChargeModal } from "@/components/modals/ReceivablePixChargeModal";
import { NewAccountModal } from "@/components/ui/NewAccountModal";
import { Search, Plus, QrCode, Eye, ArrowDownLeft, Send, Trash2, Edit3 } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { FinancialItemMock, InstallmentMock } from "@/types";

export default function ContasAReceberPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentMock | null>(null);
  const [selectedItemTitle, setSelectedItemTitle] = useState("");
  const [debtorName, setDebtorName] = useState("");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinancialItemMock | null>(null);
  const [receivablesList, setReceivablesList] = useState<FinancialItemMock[]>([]);

  const loadItems = async () => {
    const { getFinancialItems } = await import("@/server/actions/financial-items");
    const items = await getFinancialItems("RECEIVABLE");
    setReceivablesList(items as unknown as FinancialItemMock[]);
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

  const filteredReceivables = receivablesList.filter((item) =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.contact?.name && item.contact.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

      {/* Busca */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar direito a receber por projeto ou cliente..."
            className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 pl-9 pr-4 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none"
          />
        </div>
      </div>

      {/* Lista de Recebíveis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredReceivables.map((item) => (
          <div
            key={item.id}
            onDoubleClick={() => {
              setEditingItem(item);
              setIsNewModalOpen(true);
            }}
            title="Dar 2 cliques para editar este recebível"
            className="rounded-xl border border-novex-border bg-novex-surface1 p-5 space-y-4 hover:border-emerald-500/50 transition-all relative group cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  {item.category}
                </span>
                <h3 className="text-base font-bold text-novex-text-primary mt-0.5">{item.title}</h3>
                <p className="text-xs text-novex-text-muted mt-1">{item.contact?.name}</p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-emerald-400">
                    {formatCurrency(item.totalAmountCents)}
                  </span>
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
                  {item.installments.length} parcela(s)
                </span>
              </div>
            </div>

            {/* Parcelas */}
            <div className="space-y-2 border-t border-novex-border/60 pt-3">
              <span className="text-[11px] font-semibold text-novex-text-secondary block">
                Parcelas Agendadas:
              </span>
              {item.installments.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between rounded-lg bg-novex-surface2/60 p-2.5 text-xs border border-novex-border/40"
                >
                  <div>
                    <span className="font-semibold text-novex-text-primary">
                      Parcela {inst.sequence}/{inst.totalSequences} — {formatCurrency(inst.amountCents)}
                    </span>
                    <span className="text-[10px] text-novex-text-muted block">
                      Vencimento: {formatDate(inst.dueDate)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={inst.status} />
                    {inst.status !== "SETTLED" && (
                      <button
                        onClick={() => {
                          setSelectedItemTitle(item.title);
                          setDebtorName(item.contact?.name || "Devedor");
                          setSelectedInstallment(inst);
                        }}
                        className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                      >
                        <QrCode className="h-3 w-3" />
                        <span>Cobrar via Pix</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

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
      />
    </div>
  );
}
