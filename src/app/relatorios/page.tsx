"use client";

import React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { BarChart3, TrendingUp, Download, PieChart } from "lucide-react";
import { MOCK_CHART_DATA, MOCK_BALANCE_SUMMARY } from "@/mocks/financial-data";
import { formatCurrency } from "@/lib/formatters";
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
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Relatórios & Projeção Financeira"
        description="Análise detalhada do fluxo de caixa, comparativo mensal e distribuição por categoria."
        actions={
          <button
            onClick={() => alert("Exemplo demonstrativo: Exportar relatório em PDF / Excel.")}
            className="flex items-center gap-2 rounded-lg bg-novex-surface2 hover:bg-novex-border text-novex-text-primary border border-novex-border px-4 py-2 text-xs font-semibold transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Exportar Relatório</span>
          </button>
        }
      />

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
              <BarChart data={MOCK_CHART_DATA}>
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
                  formatter={(val: any) => [`R$ ${val.toLocaleString("pt-BR")},00`, ""]}
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
              <span className="text-xl font-bold text-emerald-400">R$ 11.020,00</span>
            </div>

            <div className="rounded-lg bg-novex-surface2 p-3 border border-novex-border/60">
              <span className="text-novex-text-muted block">Média de Despesa Mensal</span>
              <span className="text-xl font-bold text-novex-text-primary">R$ 4.540,00</span>
            </div>

            <div className="rounded-lg bg-novex-cyan/15 p-3 border border-novex-cyan/40">
              <span className="text-novex-cyan block font-semibold">Superávit Médio Estimado</span>
              <span className="text-xl font-bold text-novex-cyan">R$ 6.480,00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
