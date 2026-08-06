"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Search, Filter, RefreshCw, CheckCircle2, ArrowRightLeft, Link2, Tag } from "lucide-react";
import { MOCK_EXTERNAL_TRANSACTIONS, MOCK_BALANCE_SUMMARY } from "@/mocks/financial-data";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

export default function MovimentacoesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredTxs = MOCK_EXTERNAL_TRANSACTIONS.filter((tx) => {
    const matchesSearch =
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.counterpartName && tx.counterpartName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "ALL") return matchesSearch;
    return matchesSearch && tx.reconciliationStatus === statusFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Extrato de Movimentações (Mercado Pago)"
        description="Sincronização automática de entradas, saídas e compras com motor de conciliação por score."
        actions={
          <div className="flex items-center gap-2 text-xs text-novex-text-secondary bg-novex-surface1 px-3 py-1.5 rounded-lg border border-novex-border">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Última Sincronização: {formatDateTime(MOCK_BALANCE_SUMMARY.lastSyncAt)}</span>
          </div>
        }
      />

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-novex-border bg-novex-surface1 p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por estabelecimento, valor ou referência..."
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
              <option value="ALL">Todas as Conciliações</option>
              <option value="MATCHED">Conciliadas Automaticamente</option>
              <option value="SUGGESTED">Sugestões de Vínculo</option>
              <option value="UNMATCHED">Não Conciliadas / Compras Externas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Extrato Importado */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-novex-border bg-novex-surface2/60 text-novex-text-muted uppercase text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Data / Hora</th>
                <th className="py-3.5 px-4">Descrição / Origem</th>
                <th className="py-3.5 px-4">Contraparte</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Valor Liquidador</th>
                <th className="py-3.5 px-4">Conciliação</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-novex-border/60">
              {filteredTxs.map((tx) => (
                <tr key={tx.id} className="hover:bg-novex-surface2/40 transition-colors">
                  <td className="py-4 px-4 text-novex-text-secondary font-mono text-[11px]">
                    {formatDateTime(tx.occurredAt)}
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-semibold text-novex-text-primary">{tx.description}</div>
                    <div className="text-[10px] text-novex-text-muted font-mono">{tx.externalId}</div>
                  </td>
                  <td className="py-4 px-4 text-novex-text-secondary">
                    {tx.counterpartName || "Não identificado"}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold inline-block ${
                        tx.category === "Não categorizada"
                          ? "bg-zinc-800 text-amber-300 border border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {tx.category}
                    </span>
                  </td>
                  <td
                    className={`py-4 px-4 font-bold text-sm ${
                      tx.direction === "CREDIT" ? "text-emerald-400" : "text-novex-text-primary"
                    }`}
                  >
                    {tx.direction === "CREDIT" ? "+" : "-"}{formatCurrency(tx.amountCents)}
                  </td>
                  <td className="py-4 px-4">
                    <StatusBadge status={tx.reconciliationStatus} />
                  </td>
                  <td className="py-4 px-4 text-right">
                    {tx.reconciliationStatus === "SUGGESTED" && (
                      <button
                        onClick={() => alert(`Confirmado vínculo de ${tx.description} com a conta correspondente!`)}
                        className="flex items-center gap-1 ml-auto rounded bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 text-[11px] font-semibold transition-colors"
                      >
                        <Link2 className="h-3 w-3" />
                        <span>Confirmar Vínculo</span>
                      </button>
                    )}
                    {tx.reconciliationStatus === "UNMATCHED" && (
                      <button
                        onClick={() => alert(`Ação: Corrigir categoria para a compra "${tx.description}".`)}
                        className="flex items-center gap-1 ml-auto rounded bg-novex-surface2 hover:bg-novex-border text-novex-cyan px-2.5 py-1 text-[11px] font-semibold border border-novex-border transition-colors"
                      >
                        <Tag className="h-3 w-3" />
                        <span>Categorizar</span>
                      </button>
                    )}
                    {tx.reconciliationStatus === "MATCHED" && (
                      <span className="text-[11px] text-emerald-400 font-medium">Vinculado 100%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
