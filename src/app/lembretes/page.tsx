"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Bell, Clock, ShieldCheck, Check } from "lucide-react";
import { MOCK_NOTIFICATION_RULE } from "@/mocks/financial-data";

export default function LembretesPage() {
  const [rule, setRule] = useState(MOCK_NOTIFICATION_RULE);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Lembretes & Notificações"
        description="Configuração de alertas pré-vencimento, dia do vencimento e pós-atraso."
      />

      <div className="max-w-2xl rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-novex-border pb-4">
          <div className="rounded-lg bg-novex-cyan/20 p-2.5 text-novex-cyan border border-novex-cyan/40">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-novex-text-primary">Regra Global de Lembretes</h3>
            <p className="text-xs text-novex-text-secondary">Defina o comportamento padrão para novas contas a pagar e receber.</p>
          </div>
        </div>

        {/* Antecedência */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-novex-text-primary block">
            Disparar alertas com quantos dias de antecedência?
          </label>
          <div className="flex flex-wrap gap-3">
            {[7, 3, 1].map((day) => (
              <label
                key={day}
                className="flex items-center gap-2 rounded-lg border border-novex-border bg-novex-surface2/60 px-3 py-2 text-xs text-novex-text-primary cursor-pointer hover:border-novex-cyan transition-colors"
              >
                <input
                  type="checkbox"
                  checked={rule.daysBefore.includes(day)}
                  onChange={() => {
                    const exists = rule.daysBefore.includes(day);
                    setRule({
                      ...rule,
                      daysBefore: exists
                        ? rule.daysBefore.filter((d) => d !== day)
                        : [...rule.daysBefore, day],
                    });
                  }}
                  className="rounded accent-cyan-400"
                />
                <span>{day} dia(s) antes</span>
              </label>
            ))}
          </div>
        </div>

        {/* No vencimento & atraso */}
        <div className="space-y-3 border-t border-novex-border/60 pt-4 text-xs">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rule.onDueDate}
              onChange={(e) => setRule({ ...rule, onDueDate: e.target.checked })}
              className="rounded accent-cyan-400"
            />
            <span className="font-semibold text-novex-text-primary">Alerta no dia do vencimento (às 09:00)</span>
          </label>
        </div>

        {/* Canais */}
        <div className="space-y-3 border-t border-novex-border/60 pt-4">
          <label className="text-xs font-semibold text-novex-text-primary block">
            Canais de Notificação Ativos
          </label>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-novex-cyan/40 bg-novex-cyan/10 p-3 text-novex-cyan flex items-center justify-between font-semibold">
              <span>Painel / Dashboard</span>
              <Check className="h-4 w-4" />
            </div>
            <div className="rounded-lg border border-novex-border bg-novex-surface2 p-3 text-novex-text-muted flex items-center justify-between">
              <span>E-mail & WhatsApp (Fase Futura)</span>
              <span className="text-[10px] bg-novex-border px-1.5 py-0.5 rounded">Em breve</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg py-2.5 font-semibold text-xs shadow-sm glow-cyan-subtle"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          <span>{saved ? "Configurações Salvas!" : "Salvar Configurações"}</span>
        </button>
      </div>
    </div>
  );
}
