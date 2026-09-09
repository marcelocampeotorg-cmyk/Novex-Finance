"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  MessageCircle,
  ArrowRight,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { getLiveDashboardAlerts, LiveAlertItem } from "@/server/actions/notification-summary";

export function LiveNotificationPopup() {
  const [alerts, setAlerts] = useState<LiveAlertItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const DURATION_MS = 10000; // 10 segundos conforme pedido pelo usuário

  useEffect(() => {
    // Carregar alertas ao montar a tela
    getLiveDashboardAlerts().then((res) => {
      if (res.success && res.alerts.length > 0) {
        setAlerts(res.alerts);
        setIsVisible(true);
      }
    });
  }, []);

  // Controlar o timer de 10 segundos com barra de progresso
  useEffect(() => {
    if (!isVisible || alerts.length === 0 || isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const stepMs = 50;
    const decrement = (stepMs / DURATION_MS) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          // Se tiver mais alertas, avança para o próximo ou fecha
          if (currentIndex < alerts.length - 1) {
            setCurrentIndex((curr) => curr + 1);
            return 100;
          } else {
            setIsVisible(false);
            return 0;
          }
        }
        return prev - decrement;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isVisible, alerts.length, currentIndex, isPaused]);

  if (!isVisible || alerts.length === 0) return null;

  const currentAlert = alerts[currentIndex] || alerts[0];

  const getIcon = () => {
    switch (currentAlert.type) {
      case "OVERDUE":
        return <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />;
      case "DUE_TODAY":
        return <Clock className="h-5 w-5 text-amber-400 shrink-0" />;
      case "PAYMENT_RECEIVED":
        return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
      case "WHATSAPP_SENT":
        return <MessageCircle className="h-5 w-5 text-novex-cyan shrink-0" />;
      default:
        return <Sparkles className="h-5 w-5 text-novex-cyan shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (currentAlert.type) {
      case "OVERDUE":
        return "border-red-500/40 shadow-red-950/30";
      case "DUE_TODAY":
        return "border-amber-500/40 shadow-amber-950/30";
      case "PAYMENT_RECEIVED":
        return "border-emerald-500/40 shadow-emerald-950/30";
      default:
        return "border-novex-cyan/40 shadow-cyan-950/30";
    }
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:w-full bg-novex-surface1/95 backdrop-blur-xl border ${getBorderColor()} rounded-2xl shadow-2xl p-4 transition-all duration-300 animate-in slide-in-from-top-5 fade-in`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-novex-surface2 border border-novex-border shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-novex-text-primary">
                {currentAlert.title}
              </span>
              {currentAlert.amountCents !== undefined && (
                <span className="text-xs font-extrabold text-novex-cyan font-mono">
                  {formatCurrency(currentAlert.amountCents)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-novex-text-muted leading-relaxed">
              {currentAlert.description}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsVisible(false)}
          className="text-novex-text-muted hover:text-novex-text-primary p-1 transition-colors rounded-lg hover:bg-novex-surface2"
          title="Fechar notificação"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Rodapé interativo com contador e link */}
      <div className="mt-3 pt-2.5 border-t border-novex-border/60 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-novex-text-muted">
          <span>
            {currentIndex + 1} de {alerts.length} alerta(s)
          </span>
          {alerts.length > 1 && currentIndex < alerts.length - 1 && (
            <button
              onClick={() => {
                setCurrentIndex((curr) => curr + 1);
                setProgress(100);
              }}
              className="text-novex-cyan hover:underline flex items-center gap-0.5 font-semibold ml-2"
            >
              Próximo <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <a
          href="/contas-a-receber"
          className="text-novex-cyan font-bold hover:underline flex items-center gap-1"
        >
          Ver detalhes <ArrowRight className="h-3 w-3" />
        </a>
      </div>

      {/* Barra de progresso dos 10 segundos com auto-dismiss */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-novex-border/40 rounded-b-2xl overflow-hidden">
        <div
          className="h-full bg-novex-cyan transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
