"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PaymentDialog } from "@/components/ui/PaymentDialog";
import { AccountDetailsDrawer } from "@/components/ui/AccountDetailsDrawer";
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Users,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { FinancialItemDTO, InstallmentDTO, BalanceSummaryDTO } from "@/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export default function DashboardPage() {
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<FinancialItemDTO | null>(null);
  const [paymentInstallment, setPaymentInstallment] = useState<InstallmentDTO | null>(null);
  const [paymentAccountTitle, setPaymentAccountTitle] = useState("");
  const [mpConnected, setMpConnected] = useState(false);
  const [summary, setSummary] = useState<BalanceSummaryDTO | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentTxs, setRecentTxs] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [debtorsCount, setDebtorsCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dashboardState, setDashboardState] = useState<"loading" | "error" | "success">("loading");

  const [showAnchorModal, setShowAnchorModal] = useState(false);
  const [anchorAccountId, setAnchorAccountId] = useState("");
  const [anchorAmount, setAnchorAmount] = useState("");
  const [anchorDate, setAnchorDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingAnchor, setSavingAnchor] = useState(false);
  const [anchorMessage, setAnchorMessage] = useState<string | null>(null);

  const handleSaveAnchor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchorAccountId) return;
    const num = Number(anchorAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) {
      setAnchorMessage("Informe um valor numérico válido.");
      return;
    }
    setSavingAnchor(true);
    setAnchorMessage(null);
    try {
      const { setAccountBalanceAnchor } = await import("@/server/actions/workspace");
      const res = await setAccountBalanceAnchor({
        financialAccountId: anchorAccountId,
        openingBalanceCents: Math.round(num * 100),
        openingBalanceAt: anchorDate,
      });
      if (!res.success) {
        setAnchorMessage(res.error || "Erro ao salvar âncora.");
      } else {
        setShowAnchorModal(false);
        setAnchorAmount("");
        await loadDashboard();
      }
    } catch (err: any) {
      setAnchorMessage(err.message || "Erro inesperado.");
    } finally {
      setSavingAnchor(false);
    }
  };

  const isSyncingRef = React.useRef(false);

  const loadDashboard = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const { getDashboardData } = await import("@/server/actions/workspace");
      const res = await getDashboardData();
      if (!res.success || !res.summary) throw new Error(res.error || "Falha ao carregar dados financeiros.");
      if (res.summary) setSummary(res.summary);
      if (res.chartData) setChartData(res.chartData);
      if (res.recentTransactions) setRecentTxs(res.recentTransactions);
      if (res.payables) setPayables(res.payables);
      if (typeof res.debtorsCount === "number") setDebtorsCount(res.debtorsCount);
      setDashboardState("success");
    } catch (e) {
      console.error("Erro ao carregar dados do dashboard com auto-sync:", e);
      setSyncError("Erro de comunicação com o servidor.");
      setDashboardState("error");
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    import("@/server/actions/integrations").then(({ getMercadoPagoIntegrationStatus }) => {
      getMercadoPagoIntegrationStatus().then((res) => {
        setMpConnected(res.isConnected);
      }).catch(() => setMpConnected(false));
    });

    loadDashboard();

    // Polling inteligente a cada 15 segundos em segundo plano
    let lastKnownTimestamp = 0;
    const interval = setInterval(async () => {
      if (isSyncingRef.current) return;
      try {
        const { getWorkspaceLastUpdateTimestamp } = await import("@/server/actions/workspace");
        const res = await getWorkspaceLastUpdateTimestamp();
        if (res.success && res.timestamp > lastKnownTimestamp) {
          if (lastKnownTimestamp !== 0) {
            loadDashboard();
          }
          lastKnownTimestamp = res.timestamp;
        }
      } catch (e) {
        // Falha silenciosa no polling em background
      }
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleOpenPayment = (item: FinancialItemDTO, inst: InstallmentDTO) => {
    setPaymentAccountTitle(item.title);
    setPaymentInstallment(inst);
  };

  if (dashboardState === "error") return <div className="p-8 text-sm text-red-400">{syncError || "Não foi possível carregar os dados financeiros."}</div>;
  if (dashboardState === "loading" || !summary) return <div className="p-8 text-sm text-novex-text-secondary">Carregando dados financeiros...</div>;
  const displaySummary = summary;
  const now = new Date();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthRangeLabel = `de 01/${currentMonthNum} a ${String(lastDay).padStart(2, "0")}/${currentMonthNum}`;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Visão Geral das Finanças"
        description="Acompanhamento transparente do seu saldo, fluxo de caixa e conciliação financeira."
        actions={
          <button
            onClick={async () => {
              setIsSyncing(true); setSyncError(null);
              try { const { triggerMercadoPagoSync } = await import("@/server/actions/workspace"); const result = await triggerMercadoPagoSync(true); if (!result.success) throw new Error(("error" in result ? String(result.error) : "") || ("message" in result ? String(result.message) : "Falha ao solicitar atualização.")); await loadDashboard(); }
              catch (error: any) { setSyncError(error.message || "Falha ao solicitar atualização."); }
              finally { setIsSyncing(false); }
            }}
            disabled={isSyncing}
            className={`flex items-center gap-2 text-xs px-3.5 py-2 rounded-lg border transition-all ${
              isSyncing || displaySummary.syncSource === "PROCESSANDO"
                ? "bg-novex-surface1 text-novex-cyan border-novex-cyan/40 cursor-wait shadow-sm"
                : syncError || displaySummary.syncSource === "FALHA"
                ? "bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20"
                : displaySummary.syncSource === "DESCONECTADO" || displaySummary.syncSource === "PENDENTE"
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
            }`}
            title="Clique para sincronizar com Mercado Pago agora"
          >
            {isSyncing || displaySummary.syncSource === "PROCESSANDO" ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-novex-cyan" />
                <span className="font-semibold text-novex-cyan">Sincronização em andamento...</span>
              </>
            ) : syncError || displaySummary.syncSource === "FALHA" ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="font-semibold text-red-300">
                  {syncError ? `Falha no Sync: ${syncError}` : "Falha na sincronização"}
                </span>
                <RefreshCw className="h-3.5 w-3.5 ml-1 opacity-70 hover:opacity-100" />
              </>
            ) : displaySummary.syncSource === "DESCONECTADO" || displaySummary.syncSource === "PENDENTE" ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="font-semibold text-amber-300">
                  {displaySummary.syncSource === "DESCONECTADO" ? "Integração Desconectada" : "Atualização pendente"}
                </span>
                <RefreshCw className="h-3.5 w-3.5 ml-1 opacity-70 hover:opacity-100" />
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-emerald-300">
                  Última sincronização: {displaySummary.lastSyncAt ? formatDate(displaySummary.lastSyncAt) : "pendente"}
                </span>
                <RefreshCw className="h-3.5 w-3.5 ml-1 opacity-70 hover:opacity-100" />
              </>
            )}
          </button>
        }
      />

      {/* Grid de Cards Métricos Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Saldo Mercado Pago"
          amountCents={displaySummary.mercadoPagoOfficialBalanceCents ?? 0}
          overrideText={displaySummary.mercadoPagoOfficialBalanceCents === null ? "Em reconciliação" : undefined}
          subtitle={displaySummary.mercadoPagoOfficialBalanceCents === null ? "Aguardando âncora oficial comprovada" : "Saldo oficial comprovado"}
          icon={Wallet}
          variant="cyan"
          badgeText={displaySummary.mercadoPagoOfficialBalanceCents === null ? "Em Reconciliação" : "Oficial"}
          valueColor="white"
        />

        <MetricCard
          title="Ganhos do Mês (Entradas)"
          amountCents={displaySummary.monthIncomeCents ?? 0}
          subtitle={`Entradas ${monthRangeLabel}`}
          icon={ArrowDownLeft}
          variant="success"
          badgeText="Mês Atual"
          valueColor="green"
        />

        <MetricCard
          title="Gastos do Mês (Saídas)"
          amountCents={displaySummary.monthExpenseCents ?? 0}
          subtitle={`Saídas ${monthRangeLabel}`}
          icon={ArrowUpRight}
          variant="default"
          badgeText="Mês Atual"
          valueColor="red"
        />

        <MetricCard
          title="Resultado Líquido do Mês"
          amountCents={displaySummary.monthNetCents ?? 0}
          subtitle={(displaySummary.monthNetCents ?? 0) >= 0 ? "Superávit do mês atual" : "Déficit do mês atual"}
          icon={TrendingUp}
          variant={(displaySummary.monthNetCents ?? 0) >= 0 ? "success" : "default"}
          badgeText={(displaySummary.monthNetCents ?? 0) >= 0 ? "Positivo" : "Atenção"}
          valueColor={(displaySummary.monthNetCents ?? 0) >= 0 ? "green" : "red"}
        />
      </div>

      {/* Grid de Avisos e Alertas Importantes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Banner Vencimento Crítico */}
        <div className="lg:col-span-2 rounded-xl border border-novex-border bg-novex-surface1 p-5 flex items-start gap-4 shadow-sm">
          <div className="rounded-lg bg-novex-cyan/10 p-2.5 text-novex-cyan border border-novex-cyan/30 shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-novex-text-primary">Seus próximos pagamentos</h3>
              <span className="text-xs font-bold text-emerald-400">
                {formatCurrency(displaySummary.totalPayableMonthCents || 0)}
              </span>
            </div>
            <p className="text-xs text-novex-text-secondary mt-1">
              {displaySummary.totalOverdueCents > 0
                ? `Há ${formatCurrency(displaySummary.totalOverdueCents)} em pagamentos vencidos.`
                : "Não há valor vencido segundo a consulta financeira atual."}
            </p>
            {payables.length > 0 && payables[0]?.installments?.[0] && (
              <button
                onClick={() => handleOpenPayment(payables[0], payables[0].installments[0])}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg px-3.5 py-1.5 text-xs font-bold transition-colors"
              >
                <span>Pagar Pix Agora</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Resumo de Devedores */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-novex-text-secondary">Pessoas que Devem</span>
              <Users className="h-4 w-4 text-novex-cyan" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatCurrency(displaySummary.totalDebtorsOwedCents)}
            </div>
            <p className="text-xs text-novex-text-muted mt-1">
              {debtorsCount} devedor(es) com pendências ativas.
            </p>
          </div>
          <a
            href="/contas-a-receber"
            className="mt-4 flex items-center justify-between text-xs font-semibold text-novex-cyan hover:underline"
          >
            <span>Ver detalhes de cobrança</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Gráfico de Entradas vs Saídas & Movimentações Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Recharts de Fluxo Financeiro */}
        <div className="lg:col-span-2 rounded-xl border border-novex-border bg-novex-surface1 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-novex-text-primary">Evolução de Entradas e Saídas</h3>
              <p className="text-xs text-novex-text-muted">Histórico de fluxo de caixa em R$ nos últimos 6 meses.</p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A354D" vertical={false} />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#12172B",
                    borderColor: "#2A354D",
                    borderRadius: "8px",
                    color: "#F1F5F9",
                    fontSize: "12px",
                  }}
                  formatter={(value: any) => [`R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Area type="monotone" dataKey="entradas" stroke="#10B981" fill="#10B98133" name="Entradas" />
                <Area type="monotone" dataKey="saídas" stroke="#EF4444" fill="#EF444433" name="Saídas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Extrato de Movimentações Recentes Importadas */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-novex-text-primary">Movimentações Mercado Pago</h3>
            <a href="/movimentacoes" className="text-xs text-novex-cyan hover:underline">
              Ver extrato
            </a>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1">
            {recentTxs.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg border border-novex-border bg-novex-surface2/50 text-xs"
              >
                <div>
                  <div className="font-semibold text-novex-text-primary">{tx.counterpartName || tx.description}</div>
                  <div className="text-[10px] text-novex-text-muted mt-0.5">{tx.category}</div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-bold ${
                      tx.direction === "CREDIT" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {tx.direction === "CREDIT" ? "+" : "-"}{formatCurrency(tx.amountCents)}
                  </div>
                  <StatusBadge status={tx.reconciliationStatus} className="mt-1 text-[9px] px-1.5 py-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de Próximos Vencimentos */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-novex-text-primary">Próximos Vencimentos</h3>
            <p className="text-xs text-novex-text-muted">Compromissos agendados para os próximos dias.</p>
          </div>
          <a href="/contas-a-pagar" className="text-xs text-novex-cyan hover:underline">
            Ver todas
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-novex-border bg-novex-surface2/60 text-novex-text-muted uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Título</th>
                <th className="py-3 px-4">Favorecido</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-novex-border/60">
              {payables.map((item) => {
                const inst = item.installments[0];
                return (
                  <tr key={item.id} className="hover:bg-novex-surface2/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-novex-text-primary">{item.title}</td>
                    <td className="py-3.5 px-4 text-novex-text-secondary">{item.contact?.name}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                        style={{ backgroundColor: item.categoryColor }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-novex-text-secondary">{formatDate(inst.dueDate)}</td>
                    <td className="py-3.5 px-4 font-bold text-red-400">{formatCurrency(inst.amountCents)}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inst.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenPayment(item, inst)}
                        className="rounded-lg bg-novex-cyan px-3 py-1.5 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover transition-colors"
                      >
                        Pagar Pix
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais e Drawers de Interação */}
      <PaymentDialog
        isOpen={!!paymentInstallment}
        onClose={() => setPaymentInstallment(null)}
        installment={paymentInstallment}
        accountTitle={paymentAccountTitle}
      />

      <AccountDetailsDrawer
        isOpen={!!selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
        item={selectedDrawerItem}
        onPayClick={(inst) => {
          setSelectedDrawerItem(null);
          setPaymentAccountTitle(selectedDrawerItem?.title || "");
          setPaymentInstallment(inst);
        }}
      />

      {/* Modal de Ajuste de Saldo Real / Âncora */}
      {showAnchorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-novex-border bg-novex-surface1 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-novex-text-primary mb-1">Ajustar Saldo Real da Conta</h3>
            <p className="text-xs text-novex-text-secondary mb-4">
              Defina o saldo exato em uma data específica. O sistema calculará o saldo atual com base neste valor inicial mais as movimentações a partir desta data.
            </p>

            <form onSubmit={handleSaveAnchor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-novex-text-secondary mb-1">Conta Financeira</label>
                <select
                  value={anchorAccountId}
                  onChange={(e) => setAnchorAccountId(e.target.value)}
                  className="w-full rounded-lg border border-novex-border bg-novex-bg px-3 py-2 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                  required
                >
                  {(displaySummary.financialAccounts || []).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === "MERCADO_PAGO" ? "Mercado Pago" : "Conta Geral"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-novex-text-secondary mb-1">Saldo Real (R$)</label>
                <input
                  type="text"
                  value={anchorAmount}
                  onChange={(e) => setAnchorAmount(e.target.value)}
                  placeholder="Ex.: 1500,00 ou 0,00"
                  inputMode="decimal"
                  className="w-full rounded-lg border border-novex-border bg-novex-bg px-3 py-2 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-novex-text-secondary mb-1">Data do Saldo</label>
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(e) => setAnchorDate(e.target.value)}
                  className="w-full rounded-lg border border-novex-border bg-novex-bg px-3 py-2 text-xs text-novex-text-primary focus:border-novex-cyan focus:outline-none"
                  required
                />
              </div>

              {anchorMessage && (
                <div className="text-xs font-semibold text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                  {anchorMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnchorModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-novex-text-secondary hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAnchor}
                  className="rounded-lg bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg font-bold px-4 py-2 text-xs transition-colors disabled:opacity-50"
                >
                  {savingAnchor ? "Salvando..." : "Salvar Saldo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
