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
import { FinancialItemMock, InstallmentMock, BalanceSummaryMock } from "@/types";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export default function DashboardPage() {
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<FinancialItemMock | null>(null);
  const [paymentInstallment, setPaymentInstallment] = useState<InstallmentMock | null>(null);
  const [paymentAccountTitle, setPaymentAccountTitle] = useState("");
  const [mpConnected, setMpConnected] = useState(false);
  const [summary, setSummary] = useState<BalanceSummaryMock | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentTxs, setRecentTxs] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [debtorsCount, setDebtorsCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isSyncingRef = React.useRef(false);

  const loadDashboard = async (forceSync: boolean = true) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const { triggerMercadoPagoSync, getDashboardData } = await import("@/server/actions/workspace");

      try {
        const syncRes = await triggerMercadoPagoSync(forceSync);
        if (!syncRes.success && "error" in syncRes && typeof syncRes.error === "string") {
          setSyncError(syncRes.error);
        }
      } catch (syncErr: any) {
        console.warn("Mercado Pago sync ignorado ou com erro:", syncErr?.message);
      }

      const res = await getDashboardData();
      if (res.summary) setSummary(res.summary);
      if (res.chartData) setChartData(res.chartData);
      if (res.recentTransactions) setRecentTxs(res.recentTransactions);
      if (res.payables) setPayables(res.payables);
      if (typeof res.debtorsCount === "number") setDebtorsCount(res.debtorsCount);
    } catch (e) {
      console.error("Erro ao carregar dados do dashboard com auto-sync:", e);
      setSyncError("Erro de comunicação com o servidor.");
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

    loadDashboard(false);

    // Polling a cada 5 minutos em segundo plano
    const interval = setInterval(() => {
      loadDashboard(false);
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleOpenPayment = (item: FinancialItemMock, inst: InstallmentMock) => {
    setPaymentAccountTitle(item.title);
    setPaymentInstallment(inst);
  };

  const displaySummary = summary || {
    currentBalanceCents: 0,
    projectedBalanceCents: 0,
    totalPayableMonthCents: 0,
    totalReceivableMonthCents: 0,
    totalOverdueCents: 0,
    totalDebtorsOwedCents: 0,
    lastSyncAt: new Date().toISOString(),
    syncSource: "CALCULADO" as const,
    accountDisplayName: "-",
    unresolvedTransactionsCount: 0,
    uncategorizedCount: 0,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Visão Geral — Dashboard"
        description="Acompanhamento automatizado de saldo, fluxo de caixa e conciliação Mercado Pago."
        actions={
          <button
            onClick={() => loadDashboard(true)}
            disabled={isSyncing}
            className={`flex items-center gap-2 text-xs px-3.5 py-2 rounded-lg border transition-all ${
              isSyncing
                ? "bg-novex-surface1 text-novex-cyan border-novex-cyan/40 cursor-wait shadow-sm"
                : syncError || (displaySummary.syncSource !== "SINCRONIZADO" && displaySummary.syncSource !== "CALCULADO")
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
            }`}
            title="Clique para sincronizar com Mercado Pago agora"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-novex-cyan" />
                <span className="font-semibold text-novex-cyan">Sincronizando...</span>
              </>
            ) : syncError || displaySummary.syncSource === "DESCONECTADO" || displaySummary.syncSource === "PENDENTE" ? (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="font-semibold">
                  {displaySummary.syncSource === "DESCONECTADO"
                    ? "Mercado Pago Desconectado"
                    : syncError
                    ? `Falha no Sync (${syncError})`
                    : "Não Sincronizado"}
                </span>
                <RefreshCw className="h-3.5 w-3.5 ml-1 opacity-70 hover:opacity-100" />
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold">
                  Sincronizado ({displaySummary.lastSyncAt ? formatDate(displaySummary.lastSyncAt) : "Pendente"})
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
          title="Saldo Atual"
          amountCents={displaySummary.currentBalanceCents}
          subtitle={mpConnected ? "Sincronizado via Mercado Pago API" : "Conta Local"}
          icon={Wallet}
          variant="cyan"
          badgeText={mpConnected ? "Conectado MP" : "Não Conectado"}
          valueColor="white"
        />

        <MetricCard
          title="Saldo Projetado no Mês"
          amountCents={displaySummary.projectedBalanceCents}
          subtitle="Saldo + Recebimentos - Pagamentos"
          icon={TrendingUp}
          variant="default"
          valueColor="auto"
        />

        <MetricCard
          title="Total a Pagar (Pendente)"
          amountCents={displaySummary.totalPayableMonthCents}
          subtitle="Geral pendente em aberto"
          icon={ArrowUpRight}
          variant="default"
          valueColor="red"
        />

        <MetricCard
          title="Total a Receber (Pendente)"
          amountCents={displaySummary.totalReceivableMonthCents}
          subtitle="Geral previsto a entrar"
          icon={ArrowDownLeft}
          variant="success"
          valueColor="green"
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
              <h3 className="text-sm font-bold text-novex-text-primary">Status Financeiro do Workspace</h3>
              <span className="text-xs font-bold text-emerald-400">
                {formatCurrency(displaySummary.currentBalanceCents)}
              </span>
            </div>
            <p className="text-xs text-novex-text-secondary mt-1">
              {payables.length > 0
                ? "Existem contas cadastradas prontas para acompanhamento."
                : "Nenhuma conta em atraso no momento. Clique em 'Nova Conta' para cadastrar seu primeiro lançamento real."}
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
            href="/devedores"
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
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                <Bar dataKey="entradas" fill="#10B981" radius={[4, 4, 0, 0]} name="Entradas" />
                <Bar dataKey="saídas" fill="#EF4444" radius={[4, 4, 0, 0]} name="Saídas" />
              </BarChart>
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
    </div>
  );
}
