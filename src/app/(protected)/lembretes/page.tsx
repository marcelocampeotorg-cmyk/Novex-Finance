"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Bell, Clock, Check, AlertTriangle, AlertCircle, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getNotificationRule, updateNotificationRule, processNotificationAlerts, NotificationAlert } from "@/server/actions/notifications";

export default function LembretesPage() {
  const [daysBefore, setDaysBefore] = useState<number[]>([7, 3, 1]);
  const [onDueDate, setOnDueDate] = useState(true);
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleData, alertsData] = await Promise.all([
        getNotificationRule(),
        processNotificationAlerts(),
      ]);
      setDaysBefore(ruleData.daysBefore || [7, 3, 1]);
      setOnDueDate(ruleData.onDueDate ?? true);
      setAlerts(alertsData);
    } catch (err) {
      console.error("Erro ao carregar notificações:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveRule = async () => {
    try {
      const res = await updateNotificationRule({
        daysBefore,
        onDueDate,
        overdueFrequency: 1,
        hour: 9,
        channels: ["DASHBOARD"],
      });
      if (res.success) {
        setSaved(true);
        await loadData();
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("Erro ao salvar regra de notificação:", err);
    }
  };

  const toggleDayBefore = (day: number) => {
    if (daysBefore.includes(day)) {
      setDaysBefore(daysBefore.filter((d) => d !== day));
    } else {
      setDaysBefore([...daysBefore, day]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Lembretes & Notificações"
        description="Configuração de alertas pré-vencimento, dia do vencimento e dor de cabeça zero com atrasos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Configuração de Regras */}
        <div className="lg:col-span-1 rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-novex-border pb-4">
            <div className="rounded-lg bg-novex-cyan/20 p-2.5 text-novex-cyan border border-novex-cyan/40">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-novex-text-primary">Regra Global de Lembretes</h3>
              <p className="text-xs text-novex-text-secondary">Defina quando receber avisos de vencimento.</p>
            </div>
          </div>

          {/* Antecedência */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-novex-text-primary block">
              Disparar alertas com quantos dias de antecedência?
            </label>
            <div className="flex flex-col gap-2">
              {[7, 5, 3, 1].map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-3 rounded-lg border border-novex-border bg-novex-surface2/60 px-3 py-2 text-xs text-novex-text-primary cursor-pointer hover:border-novex-cyan transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={daysBefore.includes(day)}
                    onChange={() => toggleDayBefore(day)}
                    className="rounded accent-cyan-400"
                  />
                  <span>{day} dia(s) antes do vencimento</span>
                </label>
              ))}
            </div>
          </div>

          {/* No vencimento */}
          <div className="space-y-3 border-t border-novex-border/60 pt-4 text-xs">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onDueDate}
                onChange={(e) => setOnDueDate(e.target.checked)}
                className="rounded accent-cyan-400"
              />
              <span className="font-semibold text-novex-text-primary">Alerta no dia do vencimento (às 09:00)</span>
            </label>
          </div>

          <button
            onClick={handleSaveRule}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-novex-cyan hover:bg-novex-cyan/90 text-novex-bg py-3 font-bold text-xs transition-all shadow-md"
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            <span>{saved ? "Configurações Salvas!" : "Salvar Configurações"}</span>
          </button>
        </div>

        {/* Lista de Alertas Ativos no Sistema */}
        <div className="lg:col-span-2 rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-novex-border pb-3">
            <h3 className="text-base font-bold text-novex-text-primary flex items-center gap-2">
              <Clock className="h-5 w-5 text-novex-cyan" />
              <span>Painel de Alertas Ativos</span>
            </h3>
            <span className="text-xs text-novex-cyan font-mono font-bold">{alerts.length} Alerta(s)</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-novex-text-muted text-xs">Avaliando pendências e vencimentos...</div>
          ) : alerts.length === 0 ? (
            <div className="py-12 text-center text-novex-text-muted text-xs space-y-2">
              <Check className="h-8 w-8 text-emerald-400 mx-auto" />
              <p className="font-semibold text-novex-text-primary">Tudo em dia!</p>
              <p className="text-novex-text-secondary">Nenhum alerta de vencimento ou atraso pendente no momento.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
                    alert.type === "OVERDUE"
                      ? "border-rose-500/50 bg-rose-500/10"
                      : alert.type === "DUE_TODAY"
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-novex-border bg-novex-surface2/50"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {alert.type === "OVERDUE" ? (
                        <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                      ) : alert.type === "DUE_TODAY" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      ) : (
                        <Bell className="h-4 w-4 text-novex-cyan shrink-0" />
                      )}
                      <span className="font-bold text-novex-text-primary text-sm">{alert.title}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          alert.type === "OVERDUE"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : alert.type === "DUE_TODAY"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        }`}
                      >
                        {alert.type === "OVERDUE" ? "Atrasada" : alert.type === "DUE_TODAY" ? "Hoje" : "Próxima"}
                      </span>
                    </div>
                    <p className="text-novex-text-secondary text-[11px]">{alert.message}</p>
                    <div className="text-[10px] text-novex-text-muted flex items-center gap-2">
                      <span>{alert.contactName || "Sem contato"}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="h-3 w-3" /> Vencimento: {formatDate(alert.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-extrabold text-sm font-mono text-novex-text-primary shrink-0">
                    {formatCurrency(alert.amountCents)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
