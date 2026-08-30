"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  BarChart3,
  Download,
  PieChart,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Percent,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  Layers,
  ChevronRight,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { getReconciliationSummary } from "@/server/actions/transactions";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export default function RelatoriosPage() {
  const [summary, setSummary] = useState<any>({
    totalCount: 0,
    matchedCount: 0,
    suggestedCount: 0,
    unmatchedCount: 0,
    totalCreditCents: 0,
    totalDebitCents: 0,
    totalFeeCents: 0,
    reconciliationPercentage: 0,
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [projectionDays, setProjectionDays] = useState<30 | 60 | 90>(30);
  const [projectionData, setProjectionData] = useState<any[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [monthIncome, setMonthIncome] = useState<number>(0);
  const [monthExpense, setMonthExpense] = useState<number>(0);
  const [avgReceita, setAvgReceita] = useState<number>(0);
  const [avgDespesa, setAvgDespesa] = useState<number>(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getReconciliationSummary().then(setSummary).catch(console.error);

    import("@/server/actions/workspace").then(({ getDashboardData }) => {
      getDashboardData().then((res) => {
        if (res.success && res.summary) {
          const bal = (res.summary.mercadoPagoOfficialBalanceCents ?? res.summary.consolidatedBalanceCents ?? 0) / 100;
          setCurrentBalance(bal);
          setMonthIncome((res.summary.monthIncomeCents ?? 0) / 100);
          setMonthExpense((res.summary.monthExpenseCents ?? 0) / 100);
        }

        if (res.success && res.chartData) {
          setChartData(res.chartData);
          let totalIn = 0;
          let totalOut = 0;
          const count = res.chartData.length || 1;
          res.chartData.forEach((d: any) => {
            totalIn += d.entradas || 0;
            totalOut += d.saídas || 0;
          });
          setAvgReceita(totalIn / count);
          setAvgDespesa(totalOut / count);
        }

        // Gerar projeção de fluxo de caixa futuro
        const today = new Date();
        const futurePoints = [];
        let runningBalance = (res.summary?.mercadoPagoOfficialBalanceCents ?? res.summary?.consolidatedBalanceCents ?? 0) / 100;

        for (let day = 0; day <= 90; day += 5) {
          const d = new Date();
          d.setDate(today.getDate() + day);
          const label = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

          futurePoints.push({
            day,
            date: label,
            saldoProjetado: Math.round(runningBalance * 100) / 100,
          });
        }
        setProjectionData(futurePoints);
      }).catch(console.error);
    });
  }, []);

  const superavit = avgReceita - avgDespesa;
  const filteredProjection = projectionData.filter((p) => p.day <= projectionDays);

  // Cálculos da DRE Gerencial
  const receitaBruta = monthIncome > 0 ? monthIncome : (summary.totalCreditCents / 100);
  const taxasOperacionais = (summary.totalFeeCents / 100);
  const receitaLiquida = Math.max(0, receitaBruta - taxasOperacionais);
  const despesasOperacionais = monthExpense > 0 ? monthExpense : (summary.totalDebitCents / 100);
  const resultadoLiquido = receitaLiquida - despesasOperacionais;
  const margemLiquida = receitaBruta > 0 ? Math.round((resultadoLiquido / receitaBruta) * 100) : 0;

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const { generateTransactionsCsv } = await import("@/server/actions/export");
      const res = await generateTransactionsCsv();
      if (res.success && res.csvContent && res.filename) {
        const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert(res.error || "Erro ao exportar CSV.");
      }
    } catch (e: any) {
      alert("Falha de comunicação ao exportar.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Relatórios, DRE & Projeção Financeira"
        description="Demonstrativo de Resultado do Exercício (DRE), projeção de fluxo de caixa futuro e extrato bancário oficial."
        actions={
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-novex-surface2 hover:bg-novex-border text-novex-text-primary border border-novex-border px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className={`h-4 w-4 ${exporting ? "animate-spin text-novex-cyan" : ""}`} />
            <span>{exporting ? "Exportando..." : "Exportar CSV Real"}</span>
          </button>
        }
      />

      {/* DRE Gerencial (Demonstrativo de Resultados) */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-novex-border pb-3">
          <div>
            <h3 className="text-base font-bold text-novex-text-primary flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-novex-cyan" />
              <span>Demonstrativo de Resultado do Exercício (DRE Gerencial)</span>
            </h3>
            <p className="text-xs text-novex-text-secondary mt-0.5">
              Visão executiva de receitas, deduções, custos operacionais e margem de lucro.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-novex-cyan/15 text-novex-cyan border border-novex-cyan/30">
            Margem Líquida: {margemLiquida}%
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-novex-border text-novex-text-muted font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3">Estrutura Contábil / Indicador</th>
                <th className="py-2.5 px-3 text-right">Valor no Período</th>
                <th className="py-2.5 px-3 text-right">% Receita Bruta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-novex-border/40 font-mono">
              <tr className="hover:bg-novex-surface2/30">
                <td className="py-3 px-3 font-semibold text-novex-text-primary flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">(+)</span>
                  <span>Receita Operacional Bruta (Entradas / Pix / Vendas)</span>
                </td>
                <td className="py-3 px-3 text-right font-bold text-emerald-400">
                  {formatCurrency(Math.round(receitaBruta * 100))}
                </td>
                <td className="py-3 px-3 text-right text-novex-text-secondary">100.0%</td>
              </tr>

              <tr className="hover:bg-novex-surface2/30">
                <td className="py-3 px-3 text-novex-text-secondary flex items-center gap-2 pl-6">
                  <span className="text-amber-400 font-bold">(-)</span>
                  <span>Taxas e Tarifas do Mercado Pago / Meios de Pagamento</span>
                </td>
                <td className="py-3 px-3 text-right text-amber-300">
                  {formatCurrency(Math.round(taxasOperacionais * 100))}
                </td>
                <td className="py-3 px-3 text-right text-novex-text-secondary">
                  {receitaBruta > 0 ? ((taxasOperacionais / receitaBruta) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>

              <tr className="bg-novex-surface2/40 font-bold">
                <td className="py-3 px-3 text-novex-text-primary flex items-center gap-2">
                  <span className="text-novex-cyan">(=)</span>
                  <span>Receita Operacional Líquida</span>
                </td>
                <td className="py-3 px-3 text-right text-novex-cyan">
                  {formatCurrency(Math.round(receitaLiquida * 100))}
                </td>
                <td className="py-3 px-3 text-right text-novex-cyan">
                  {receitaBruta > 0 ? ((receitaLiquida / receitaBruta) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>

              <tr className="hover:bg-novex-surface2/30">
                <td className="py-3 px-3 text-novex-text-secondary flex items-center gap-2 pl-6">
                  <span className="text-rose-400 font-bold">(-)</span>
                  <span>Despesas Operacionais e Saídas Financeiras</span>
                </td>
                <td className="py-3 px-3 text-right text-rose-400">
                  {formatCurrency(Math.round(despesasOperacionais * 100))}
                </td>
                <td className="py-3 px-3 text-right text-novex-text-secondary">
                  {receitaBruta > 0 ? ((despesasOperacionais / receitaBruta) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>

              <tr className="bg-novex-cyan/10 border-t border-b border-novex-cyan/40 font-extrabold text-sm">
                <td className="py-3.5 px-3 text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-novex-cyan" />
                  <span>Resultado Líquido do Exercício (Lucro / Superávit)</span>
                </td>
                <td className={`py-3.5 px-3 text-right ${resultadoLiquido >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {formatCurrency(Math.round(resultadoLiquido * 100))}
                </td>
                <td className="py-3.5 px-3 text-right text-white">
                  {margemLiquida}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Projeção de Fluxo de Caixa Futuro (30 / 60 / 90 dias) */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-novex-border pb-3">
          <div>
            <h3 className="text-base font-bold text-novex-text-primary flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-novex-cyan" />
              <span>Projeção de Fluxo de Caixa Futuro</span>
            </h3>
            <p className="text-xs text-novex-text-secondary mt-0.5">
              Estimativa da curva de saldo para os próximos 30, 60 ou 90 dias.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-novex-bg p-1 rounded-lg border border-novex-border self-start sm:self-auto">
            <button
              onClick={() => setProjectionDays(30)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                projectionDays === 30 ? "bg-novex-cyan text-novex-bg shadow-sm" : "text-novex-text-secondary hover:text-white"
              }`}
            >
              30 Dias
            </button>
            <button
              onClick={() => setProjectionDays(60)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                projectionDays === 60 ? "bg-novex-cyan text-novex-bg shadow-sm" : "text-novex-text-secondary hover:text-white"
              }`}
            >
              60 Dias
            </button>
            <button
              onClick={() => setProjectionDays(90)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                projectionDays === 90 ? "bg-novex-cyan text-novex-bg shadow-sm" : "text-novex-text-secondary hover:text-white"
              }`}
            >
              90 Dias
            </button>
          </div>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A354D" vertical={false} />
              <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#12172B",
                  borderColor: "#2A354D",
                  borderRadius: "8px",
                  color: "#F1F5F9",
                }}
                formatter={(val: any) => [`R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Saldo Projetado"]}
              />
              <Line
                type="monotone"
                dataKey="saldoProjetado"
                stroke="#06B6D4"
                strokeWidth={3}
                dot={{ fill: "#06B6D4", r: 4 }}
                activeDot={{ r: 6, fill: "#FFFFFF" }}
                name="Saldo Projetado (R$)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Relatório Dinheiro em Conta (Mercado Pago / Liquidação Bancária) */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-novex-border pb-3">
          <h3 className="text-base font-bold text-novex-text-primary flex items-center gap-2">
            <Landmark className="h-5 w-5 text-novex-cyan" />
            <span>Extrato Oficial de Liquidação (Mercado Pago)</span>
          </h3>
          <span className="text-xs text-novex-text-muted font-mono">
            {summary.reconciliationPercentage}% das movimentações conciliadas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="rounded-lg bg-novex-surface2 p-3 border border-novex-border/60">
            <span className="text-novex-text-muted text-xs block">Volume Total de Entradas</span>
            <span className="text-lg font-bold text-emerald-400 font-mono flex items-center gap-1 mt-1">
              <ArrowDownLeft className="h-4 w-4" />
              {formatCurrency(summary.totalCreditCents)}
            </span>
          </div>

          <div className="rounded-lg bg-novex-surface2 p-3 border border-novex-border/60">
            <span className="text-novex-text-muted text-xs block">Volume Total de Saídas</span>
            <span className="text-lg font-bold text-rose-400 font-mono flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-4 w-4" />
              {formatCurrency(summary.totalDebitCents)}
            </span>
          </div>

          <div className="rounded-lg bg-novex-surface2 p-3 border border-novex-border/60">
            <span className="text-novex-text-muted text-xs block">Tarifas de Liquidação MP</span>
            <span className="text-lg font-bold text-amber-300 font-mono mt-1 block">
              {formatCurrency(summary.totalFeeCents)}
            </span>
          </div>

          <div className="rounded-lg bg-novex-cyan/15 p-3 border border-novex-cyan/40">
            <span className="text-novex-cyan text-xs font-semibold block">Taxa de Conciliação</span>
            <span className="text-lg font-bold text-novex-cyan font-mono flex items-center gap-1 mt-1">
              <Percent className="h-4 w-4" />
              {summary.reconciliationPercentage}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Histórico */}
        <div className="lg:col-span-2 rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-novex-text-primary flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-novex-cyan" />
              <span>Comparativo de Entradas vs Saídas Mensais</span>
            </h3>
          </div>

          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A354D" vertical={false} />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#12172B",
                    borderColor: "#2A354D",
                    borderRadius: "8px",
                    color: "#F1F5F9",
                  }}
                  formatter={(val: any) => [`R$ ${Number(val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Bar dataKey="entradas" fill="#10B981" radius={[4, 4, 0, 0]} name="Entradas (R$)" />
                <Bar dataKey="saídas" fill="#EF4444" radius={[4, 4, 0, 0]} name="Saídas (R$)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Resumo Consolidado */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-6">
          <h3 className="text-base font-bold text-novex-text-primary flex items-center gap-2">
            <PieChart className="h-5 w-5 text-novex-cyan" />
            <span>Médias Mensais</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div className="rounded-lg bg-novex-surface2 p-3 border border-novex-border/60">
              <span className="text-novex-text-muted block">Média de Receita Mensal</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">
                R$ {avgReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="rounded-lg bg-novex-surface2 p-3 border border-novex-border/60">
              <span className="text-novex-text-muted block">Média de Despesa Mensal</span>
              <span className="text-xl font-bold text-novex-text-primary font-mono">
                R$ {avgDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="rounded-lg bg-novex-cyan/15 p-3 border border-novex-cyan/40">
              <span className="text-novex-cyan block font-semibold">Superávit Médio Estimado</span>
              <span className="text-xl font-bold text-novex-cyan font-mono">
                R$ {superavit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
