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
  CalendarClock,
  PieChart,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { formatTransactionDisplay } from "@/lib/transaction-presentation";
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
  const [installmentsForecast, setInstallmentsForecast] = useState<any[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<any[]>([]);
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
      if (res.installmentsForecast) setInstallmentsForecast(res.installmentsForecast);
      if (res.expensesByCategory) setExpensesByCategory(res.expensesByCategory);
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
    <div className="space-y-5 sm:space-y-8 animate-in fade-in duration-300">
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
            className={`flex items-center gap-1.5 sm:gap-2 text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg border transition-all max-w-full ${
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
                <RefreshCw className="h-4 w-4 animate-spin text-novex-cyan shrink-0" />
                <span className="font-semibold text-novex-cyan truncate">Sincronizando...</span>
              </>
            ) : syncError || displaySummary.syncSource === "FALHA" ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <span className="font-semibold text-red-300 truncate">
                  {syncError ? `Falha: ${syncError}` : "Falha na sincronização"}
                </span>
                <RefreshCw className="h-3.5 w-3.5 ml-1 opacity-70 hover:opacity-100 shrink-0" />
              </>
            ) : displaySummary.syncSource === "DESCONECTADO" || displaySummary.syncSource === "PENDENTE" ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span className="font-semibold text-amber-300 truncate">
                  {displaySummary.syncSource === "DESCONECTADO" ? "Integração Desconectada" : "Atualização pendente"}
                </span>
                <RefreshCw className="h-3.5 w-3.5 ml-1 opacity-70 hover:opacity-100 shrink-0" />
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-emerald-300 truncate">
                  Última sincronização: {displaySummary.lastSyncAt ? formatDate(displaySummary.lastSyncAt) : "pendente"}
                </span>
                <RefreshCw className="h-3.5 w-3.5 ml-1 opacity-70 hover:opacity-100 shrink-0" />
              </>
            )}
          </button>
        }
      />

      {/* Grid de Cards Métricos Principais - Limpo e Focado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <MetricCard
          title="Saldo Mercado Pago"
          amountCents={displaySummary.mercadoPagoOfficialBalanceCents ?? 0}
          overrideText={displaySummary.mercadoPagoOfficialBalanceCents === null ? "Em reconciliação" : undefined}
          subtitle={displaySummary.mercadoPagoOfficialBalanceCents === null
            ? "Relatório Liberações indisponível ou em reconciliação"
            : `${displaySummary.mercadoPagoBalanceBasis === "RELEASE_PLUS_ACCOUNT_MONEY" ? "Atualizado por fontes oficiais" : "Âncora oficial"}${displaySummary.mercadoPagoOfficialBalanceAt ? ` até ${new Date(displaySummary.mercadoPagoOfficialBalanceAt).toLocaleString("pt-BR")}` : ""}`}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Banner Vencimento Crítico */}
        <div className="lg:col-span-2 rounded-xl border border-novex-border bg-novex-surface1 p-4 sm:p-5 flex items-start gap-3.5 sm:gap-4 shadow-sm">
          <div className="rounded-lg bg-novex-cyan/10 p-2 sm:p-2.5 text-novex-cyan border border-novex-cyan/30 shrink-0">
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-novex-text-primary">Seus próximos pagamentos</h3>
              <span className="text-xs font-bold text-emerald-400 shrink-0">
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
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-novex-text-secondary">Pessoas que Devem</span>
              <Users className="h-4 w-4 text-novex-cyan" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400">
              {formatCurrency(displaySummary.totalDebtorsOwedCents)}
            </div>
            <p className="text-xs text-novex-text-muted mt-1">
              {debtorsCount} devedor(es) com pendências ativas.
            </p>
          </div>
          <a
            href="/contas-a-receber"
            className="mt-3 sm:mt-4 flex items-center justify-between text-xs font-semibold text-novex-cyan hover:underline"
          >
            <span>Ver detalhes de cobrança</span>
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Seção Inteligente: Faturas Futuras & Raio-X de Gastos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Card 1: Previsão de Parcelamentos Futuros */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-novex-cyan" />
                <h3 className="text-sm sm:text-base font-bold text-novex-text-primary">Faturas & Parcelamentos Futuros</h3>
              </div>
              <a href="/contas-a-pagar" className="text-[11px] text-novex-cyan hover:underline">
                Ver detalhes
              </a>
            </div>
            <p className="text-xs text-novex-text-muted mb-4">
              Total já contratado e comprometido nos próximos meses.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {installmentsForecast.map((item, idx) => (
                <div
                  key={`${item.month}-${item.year}`}
                  className={`p-3 rounded-xl border flex flex-col justify-between ${
                    idx === 0
                      ? "bg-novex-cyan/10 border-novex-cyan/40"
                      : "bg-novex-surface2/40 border-novex-border/70"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-novex-text-primary">{item.month}/{String(item.year).slice(2)}</span>
                    <span className="text-[10px] text-novex-text-muted">{item.count} parc.</span>
                  </div>
                  <div className="mt-2 text-sm sm:text-base font-extrabold text-red-400">
                    {formatCurrency(item.totalCents)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Raio-X Mensal de Gastos por Categoria */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 sm:p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold text-novex-text-primary">Raio-X: Onde foi o seu dinheiro</h3>
              </div>
              <a href="/relatorios" className="text-[11px] text-novex-cyan hover:underline">
                Ver DRE
              </a>
            </div>
            <p className="text-xs text-novex-text-muted mb-3">
              Divisão das despesas do mês atual por categoria.
            </p>

            {expensesByCategory.length === 0 ? (
              <div className="py-6 text-center text-xs text-novex-text-muted">
                Sem despesas categorizadas registradas neste mês.
              </div>
            ) : (
              <div className="space-y-2.5">
                {expensesByCategory.map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color || "#64748B" }} />
                        <span className="font-medium text-novex-text-primary truncate">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-novex-text-primary">{formatCurrency(cat.amountCents)}</span>
                        <span className="text-[10px] text-novex-text-muted font-mono w-7 text-right">{cat.percentage}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-novex-surface2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(cat.percentage, 3)}%`,
                          backgroundColor: cat.color || "#00E5FF",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de Entradas vs Saídas & Movimentações Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Gráfico Recharts de Fluxo Financeiro */}
        <div className="lg:col-span-2 rounded-xl border border-novex-border bg-novex-surface1 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-novex-text-primary">Evolução de Entradas e Saídas</h3>
              <p className="text-xs text-novex-text-muted">Histórico de fluxo de caixa em R$ nos últimos 6 meses.</p>
            </div>
          </div>

          <div className="h-56 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A354D" vertical={false} />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#12172B",
                    borderColor: "#2A354D",
                    borderRadius: "8px",
                    color: "#F1F5F9",
                    fontSize: "12px",
                  }}
                  formatter={(value: any) => [
                    value !== undefined && value !== null
                      ? `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "R$ 0,00",
                    "",
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Area type="monotone" dataKey="entradas" stroke="#10B981" fill="#10B98133" name="Entradas" />
                <Area type="monotone" dataKey="saídas" stroke="#EF4444" fill="#EF444433" name="Saídas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Extrato de Movimentações Recentes Importadas */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm sm:text-base font-bold text-novex-text-primary">Movimentações Mercado Pago</h3>
            <a href="/movimentacoes" className="text-xs text-novex-cyan hover:underline">
              Ver extrato
            </a>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] pr-1">
            {recentTxs.length === 0 ? (
              <div className="p-6 text-center text-xs text-novex-text-muted">
                Nenhuma movimentação recente encontrada.
              </div>
            ) : (
              recentTxs.map((tx) => {
                const presentation = formatTransactionDisplay(tx);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-novex-border bg-novex-surface2/50 text-xs gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-novex-text-primary truncate" title={presentation.title}>
                        {presentation.title}
                      </div>
                      <div className="text-[10px] text-novex-text-muted mt-0.5 truncate" title={presentation.subtitle}>
                        {presentation.subtitle}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
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
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Tabela e Cards de Próximos Vencimentos */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-novex-text-primary">Próximos Vencimentos</h3>
            <p className="text-xs text-novex-text-muted">Compromissos agendados para os próximos dias.</p>
          </div>
          <a href="/contas-a-pagar" className="text-xs text-novex-cyan hover:underline">
            Ver todas
          </a>
        </div>

        {/* Versão Mobile (Cards em smartphones) */}
        <div className="block sm:hidden space-y-3">
          {payables.filter((item) => item.installments && item.installments.length > 0).length === 0 ? (
            <div className="py-6 text-center text-xs text-novex-text-muted">
              Nenhum pagamento pendente no momento.
            </div>
          ) : (
            payables
              .filter((item) => item.installments && item.installments.length > 0)
              .map((item) => {
                const inst = item.installments[0];
                if (!inst) return null;
                return (
                  <div key={item.id} className="p-3.5 rounded-xl border border-novex-border bg-novex-surface2/40 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-novex-text-primary truncate">{item.title}</div>
                        <div className="text-[11px] text-novex-text-muted mt-0.5">{item.contact?.name || "Sem contato"}</div>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-semibold text-white shrink-0"
                        style={{ backgroundColor: item.categoryColor || "#3B82F6" }}
                      >
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-novex-border/50">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-novex-text-muted">
                          Vence: {inst.dueDate ? formatDate(inst.dueDate) : "-"}
                        </span>
                        <span className="text-sm font-bold text-red-400">
                          {formatCurrency(inst.amountCents)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge status={inst.status} className="text-[10px]" />
                        <button
                          onClick={() => handleOpenPayment(item, inst)}
                          className="rounded-lg bg-novex-cyan px-3 py-1.5 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover active:scale-95 transition-all"
                        >
                          Pagar Pix
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Versão Desktop (Tabela completa) */}
        <div className="hidden sm:block overflow-x-auto">
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
              {payables.filter((item) => item.installments && item.installments.length > 0).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-novex-text-muted">
                    Nenhum pagamento pendente no momento.
                  </td>
                </tr>
              ) : (
                payables
                  .filter((item) => item.installments && item.installments.length > 0)
                  .map((item) => {
                    const inst = item.installments[0];
                    if (!inst) return null;
                    return (
                      <tr key={item.id} className="hover:bg-novex-surface2/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-novex-text-primary">{item.title}</td>
                        <td className="py-3.5 px-4 text-novex-text-secondary">{item.contact?.name || "-"}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                            style={{ backgroundColor: item.categoryColor }}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-novex-text-secondary">{inst.dueDate ? formatDate(inst.dueDate) : "-"}</td>
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
                  })
              )}
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
