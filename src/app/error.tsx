"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Despacha o erro do cliente para registro no servidor de forma assíncrona
    try {
      fetch("/api/logs/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || "Client Exception",
          stack: error?.stack,
          digest: error?.digest,
          url: typeof window !== "undefined" ? window.location.href : "unknown",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        }),
      }).catch(() => {});
    } catch {
      // Falha silenciosa no envio de telemetria
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-novex-border bg-novex-surface1 p-8 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h2 className="text-lg font-bold text-novex-text-primary">
          Instabilidade na exibição do painel
        </h2>

        <p className="mt-2 text-xs text-novex-text-secondary leading-relaxed">
          Uma falha inesperada ocorreu ao processar os dados desta tela. O incidente foi registrado automaticamente nos logs de auditoria do sistema para análise técnica.
        </p>

        {error?.message && (
          <div className="mt-4 rounded-lg bg-novex-bg p-3 border border-novex-border text-left font-mono text-[11px] text-red-300 overflow-x-auto max-h-32">
            {error.message}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 rounded-xl bg-novex-cyan px-4 py-2 text-xs font-bold text-novex-bg hover:bg-novex-cyan-hover transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Tentar Novamente</span>
          </button>

          <button
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="flex items-center gap-2 rounded-xl border border-novex-border bg-novex-surface2 px-4 py-2 text-xs font-semibold text-novex-text-primary hover:border-novex-cyan/40 transition-colors"
          >
            <span>Recarregar Página</span>
          </button>

          <a
            href="/"
            className="flex items-center gap-2 rounded-xl border border-transparent px-4 py-2 text-xs font-semibold text-novex-text-muted hover:text-novex-text-primary transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Início</span>
          </a>
        </div>
      </div>
    </div>
  );
}
