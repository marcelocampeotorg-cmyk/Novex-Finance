"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Repeat, Plus, Play, Pause, Edit, Calendar } from "lucide-react";
import { MOCK_RECURRENCES } from "@/mocks/financial-data";
import { formatCurrency, formatDate } from "@/lib/formatters";

export default function RecorrenciasPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Regras Recorrentes"
        description="Geração de compromissos periódicos automáticos (Aluguel, Assinaturas, Mensalidades)."
        actions={
          <button
            onClick={() => alert("Exemplo demonstrativo: Criar nova regra de recorrência.")}
            className="flex items-center gap-2 rounded-lg bg-novex-cyan px-4 py-2 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover transition-colors shadow-sm glow-cyan-subtle"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Nova Recorrência</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_RECURRENCES.map((rec) => (
          <div
            key={rec.id}
            className="rounded-xl border border-novex-border bg-novex-surface1 p-5 space-y-4 hover:border-novex-cyan/50 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-novex-cyan/20 p-2.5 text-novex-cyan border border-novex-cyan/40">
                  <Repeat className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-novex-text-primary">{rec.title}</h3>
                  <span className="text-xs text-novex-text-secondary">{rec.contactName}</span>
                </div>
              </div>

              <span className="text-lg font-bold text-novex-text-primary">
                {formatCurrency(rec.amountCents)}
              </span>
            </div>

            <div className="space-y-2 border-t border-novex-border/60 pt-3 text-xs">
              <div className="flex items-center justify-between text-novex-text-muted">
                <span>Frequência:</span>
                <strong className="text-novex-text-primary">{rec.frequency === "MONTHLY" ? "Mensal" : "Anual"} (Dia {rec.dayOfMonth})</strong>
              </div>
              <div className="flex items-center justify-between text-novex-text-muted">
                <span>Próxima Ocorrência:</span>
                <strong className="text-novex-cyan">{formatDate(rec.nextRunAt)}</strong>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-novex-border/60">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Ativa
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert(`Pausada recorrência ${rec.title}`)}
                  className="rounded p-1.5 text-novex-text-muted hover:bg-novex-surface2 hover:text-amber-400"
                  title="Pausar"
                >
                  <Pause className="h-4 w-4" />
                </button>
                <button
                  onClick={() => alert(`Editar recorrência ${rec.title}`)}
                  className="rounded p-1.5 text-novex-text-muted hover:bg-novex-surface2 hover:text-novex-text-primary"
                  title="Editar"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
