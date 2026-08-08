"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { BarChart3, Download, PieChart, Landmark, ArrowDownLeft, ArrowUpRight, Percent } from "lucide-react";

import { formatCurrency } from "@/lib/formatters";
import { getReconciliationSummary } from "@/server/actions/transactions";
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
  const [avgReceita, setAvgReceita] = useState<number>(0);
  const [avgDespesa, setAvgDespesa] = useState<number>(0);

  useEffect(() => {
    getReconciliationSummary().then(setSummary).catch(console.error);

    import("@/server/actions/workspace").then(({ getDashboardData }) => {
      getDashboardData().then((res) => {
        setChartData(res.chartData);
        // Calcular média dos 6 meses do gráfico
        let totalIn = 0;
        let totalOut = 0;
        let count = res.chartData.length || 1;
        res.chartData.forEach((d: any) => {
          totalIn += d.entradas || 0;
          totalOut += d.saídas || 0;
        });
        setAvgReceita(totalIn / count);
        setAvgDespesa(totalOut / count);
      }).catch(console.error);
    });
  }, []);

  const superavit = avgReceita - avgDespesa;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Relatórios & Projeção Financeira"
        description="Análise detalhada do fluxo de caixa, extrato de liquidação Dinheiro em Conta e distribuição por categoria."
        actions={
          <button
            onClick={() => alert("Relatório exportado em formato CSV / PDF.")}
            className="flex items-center gap-2 rounded-lg bg-novex-surface2 hover:bg-novex-border text-novex-text-primary border border-novex-border px-4 py-2 text-xs font-semibold transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Exportar Relatório</span>
          </button>
        }
      />

      {/* Relatório Dinheiro em Conta (Mercado Pago / Liquidação Bancária) */}
      <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-novex-border pb-3">
          <h3 className="text-base font-bold text-novex-text-primary flex items-center gap-2">
            <Landmark className="h-5 w-5 text-novex-cyan" />
            <span>Relatório Dinheiro em Conta (Mercado Pago)</span>
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
        {/* Gráfico Principal */}
        <div className="lg:col-span-2 rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-novex-text-primary flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-novex-cyan" />
              <span>Comparativo de Entradas vs Saídas</span>
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
            <span>Métricas Consolidadas</span>
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
