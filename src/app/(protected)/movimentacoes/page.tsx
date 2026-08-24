"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Search, Filter, RefreshCw, CheckCircle2, Link2, Tag, Upload, ArrowUpRight, ArrowDownLeft, XCircle, ShieldCheck } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { getExternalTransactions, getReconciliationSummary, ignoreExternalTransaction } from "@/server/actions/transactions";
import { runAutomaticReconciliationEngine, confirmSuggestedMatch, unmatchTransaction } from "@/server/actions/reconciliation";
import { ImportStatementModal } from "@/components/modals/ImportStatementModal";
import { ManualMatchModal } from "@/components/modals/ManualMatchModal";

export default function MovimentacoesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [directionFilter, setDirectionFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("MONTHLY");
  const [loading, setLoading] = useState(true);
  const [runningEngine, setRunningEngine] = useState(false);
  const [txs, setTxs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalCount: 0,
    matchedCount: 0,
    suggestedCount: 0,
    unmatchedCount: 0,
    totalCreditCents: 0,
    totalDebitCents: 0,
    reconciliationPercentage: 0,
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedTxForMatch, setSelectedTxForMatch] = useState<any | null>(null);
  const [syncMessage, setSyncMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        getExternalTransactions(periodFilter),
        getReconciliationSummary(periodFilter),
      ]);
      setTxs(list);
      setSummary(sum);
    } catch (err) {
      console.error("Erro ao carregar movimentações:", err);
    } finally {
      setLoading(false);
    }
  }, [periodFilter]);

  useEffect(() => {
    loadData();
  }, [loadData, periodFilter]);

  const handleRunReconciliationEngine = async () => {
    setRunningEngine(true);
    try {
      const res = await runAutomaticReconciliationEngine();
      if (res.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Erro ao executar conciliação:", err);
    } finally {
      setRunningEngine(false);
    }
  };

  const handleConfirmSuggestion = async (reconciliationId: string) => {
    try {
      const res = await confirmSuggestedMatch(reconciliationId);
      if (res.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Erro ao confirmar sugestão:", err);
    }
  };

  const handleUnmatch = async (reconciliationId: string) => {
    if (!confirm("Tem certeza que deseja reverter esta conciliação?")) return;
    try {
      const res = await unmatchTransaction(reconciliationId);
      if (res.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Erro ao desconciliar:", err);
    }
  };

  const handleIgnore = async (txId: string) => {
    try {
      const res = await ignoreExternalTransaction(txId);
      if (res.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Erro ao ignorar transação:", err);
    }
  };

  const filteredTxs = txs.filter((tx) => {
    const matchesSearch =
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.counterpartName && tx.counterpartName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.txid && tx.txid.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tx.rawReference && tx.rawReference.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || tx.reconciliationStatus === statusFilter;
    const matchesDirection = directionFilter === "ALL" || tx.direction === directionFilter;

    return matchesSearch && matchesStatus && matchesDirection;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Extrato de Movimentações (Mercado Pago)"
        description="Sincronização automática de entradas, saídas e compras com motor de conciliação por score."
        actions={
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setLoading(true);
                  setSyncMessage(null);
                  try {
                    const { triggerMercadoPagoSync } = await import("@/server/actions/workspace");
                    const res = await triggerMercadoPagoSync();
                    if (res && !res.success && "error" in res) {
                      setSyncMessage({ type: "error", text: "Erro ao sincronizar: " + res.error });
                    } else if (res && "error" in res && res.error) {
                      setSyncMessage({ type: "error", text: "Erro ao sincronizar: " + res.error });
                    } else {
                      setSyncMessage({ type: "success", text: "Sincronização concluída com sucesso!" });
                      await loadData();
                    }
                  } catch (err: any) {
                    setSyncMessage({ type: "error", text: "Erro inesperado: " + err.message });
                  } finally {
                    setLoading(false);
                    setTimeout(() => setSyncMessage(null), 5000);
                  }
                }}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 text-xs transition-all shadow-md disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span>Sincronizar Mercado Pago</span>
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg font-bold px-4 py-2 text-xs transition-all shadow-md"
              >
                <Upload className="h-4 w-4" />
                <span>Importar OFX</span>
              </button>
              <button
                onClick={handleRunReconciliationEngine}
                disabled={runningEngine}
                className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 text-xs transition-colors border border-purple-500/40 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${runningEngine ? "animate-spin" : ""}`} />
                <span>{runningEngine ? "Processando..." : "Rodar Conciliação"}</span>
              </button>
            </div>
            {syncMessage && (
              <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${syncMessage.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                {syncMessage.text}
              </div>
            )}
          </div>
        }
      />

      {/* Cards de Métricas Consolidadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 flex flex-col justify-between">
          <span className="text-novex-text-muted text-[11px] font-semibold uppercase">Total de Transações</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-novex-text-primary font-mono">{summary.totalCount}</span>
            <span className="text-xs text-novex-cyan font-semibold">{summary.reconciliationPercentage}% Conciliado</span>
          </div>
        </div>

        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 flex flex-col justify-between">
          <span className="text-novex-text-muted text-[11px] font-semibold uppercase">Sugestões de Vínculo</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-purple-400 font-mono">{summary.suggestedCount}</span>
            <span className="text-[10px] text-purple-300 font-medium">Requer confirmação</span>
          </div>
        </div>

        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 flex flex-col justify-between">
          <span className="text-novex-text-muted text-[11px] font-semibold uppercase">Total Créditos (Entradas)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-emerald-400 font-mono flex items-center gap-1">
              <ArrowDownLeft className="h-4 w-4" />
              {formatCurrency(summary.totalCreditCents)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 flex flex-col justify-between">
          <span className="text-novex-text-muted text-[11px] font-semibold uppercase">Total Débitos (Saídas)</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-rose-400 font-mono flex items-center gap-1">
              <ArrowUpRight className="h-4 w-4" />
              {formatCurrency(summary.totalDebitCents)}
            </span>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-novex-border bg-novex-surface1 p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por descrição, favorecido ou referência..."
            className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 pl-9 pr-4 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
          >
            <option value="DAILY">Diário (Hoje)</option>
            <option value="WEEKLY">Semanal (Últimos 7 dias)</option>
            <option value="BIWEEKLY">Quinzenal (Últimos 15 dias)</option>
            <option value="MONTHLY">Mensal (Mês Atual)</option>
            <option value="YEARLY">Anual (Ano Atual)</option>
          </select>

          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
          >
            <option value="ALL">Todas as Direções</option>
            <option value="CREDIT">Entradas (Crédito)</option>
            <option value="DEBIT">Saídas (Débito)</option>
          </select>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-novex-text-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-novex-border bg-novex-bg py-2 px-3 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
            >
              <option value="ALL">Todas as Conciliações</option>
              <option value="MATCHED">Conciliadas</option>
              <option value="SUGGESTED">Sugestões de Vínculo</option>
              <option value="UNMATCHED">Não Conciliadas</option>
              <option value="IGNORED">Ignoradas</option>
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
                <th className="py-3.5 px-4">Descrição / ID Externo</th>
                <th className="py-3.5 px-4">Favorecido / Contraparte</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Valor Bruto</th>
                <th className="py-3.5 px-4">Conciliação</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-novex-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-novex-text-muted">
                    Carregando movimentações bancárias...
                  </td>
                </tr>
              ) : filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-novex-text-muted">
                    Nenhuma movimentação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-novex-surface2/40 transition-colors">
                    <td className="py-4 px-4 text-novex-text-secondary font-mono text-[11px]">
                      {formatDateTime(tx.occurredAt)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-novex-text-primary">{tx.description}</div>
                      <div className="text-[10px] text-novex-text-muted font-mono">{tx.externalId}</div>
                    </td>
                    <td className="py-4 px-4 text-novex-text-secondary">
                      {tx.counterpartName || "Origem bancária"}
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
                      className={`py-4 px-4 font-bold ${
                        tx.direction === "CREDIT" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {tx.direction === "CREDIT" ? "+" : "-"}{formatCurrency(tx.amountCents)}
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge status={tx.reconciliationStatus} />
                      {tx.confidenceScore && (
                        <div className="text-[10px] text-purple-300 font-mono mt-0.5">Score: {tx.confidenceScore}</div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        {tx.reconciliationStatus === "SUGGESTED" && (
                          <button
                            onClick={() => handleConfirmSuggestion(tx.reconciliationId)}
                            className="flex items-center gap-1 rounded bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 text-[11px] font-semibold transition-colors"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Confirmar Vínculo</span>
                          </button>
                        )}
                        {tx.reconciliationStatus === "UNMATCHED" && (
                          <>
                            <button
                              onClick={() => setSelectedTxForMatch(tx)}
                              className="flex items-center gap-1 rounded bg-novex-surface2 hover:bg-novex-border text-novex-cyan px-2.5 py-1 text-[11px] font-semibold border border-novex-border transition-colors"
                            >
                              <Link2 className="h-3 w-3" />
                              <span>Vincular</span>
                            </button>
                            <button
                              onClick={() => handleIgnore(tx.id)}
                              className="p-1 rounded text-novex-text-muted hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                              title="Ignorar na conciliação"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {tx.reconciliationStatus === "MATCHED" && (
                          <button
                            onClick={() => handleUnmatch(tx.reconciliationId)}
                            className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-rose-400 font-medium transition-colors"
                            title="Clique para desconciliar"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                            <span>100% Vinculado</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais */}
      <ImportStatementModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={loadData}
      />

      <ManualMatchModal
        isOpen={!!selectedTxForMatch}
        externalTx={selectedTxForMatch}
        onClose={() => setSelectedTxForMatch(null)}
        onSuccess={loadData}
      />
    </div>
  );
}
