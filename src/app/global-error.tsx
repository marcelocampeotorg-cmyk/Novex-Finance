"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      fetch("/api/logs/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || "Global Client Exception",
          stack: error?.stack,
          digest: error?.digest,
          url: typeof window !== "undefined" ? window.location.href : "unknown",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        }),
      }).catch(() => {});
    } catch {
      // Falha silenciosa
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#0A0D17] text-[#F1F5F9] font-sans flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-[#2A354D] bg-[#12172B] p-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h2 className="text-lg font-bold text-[#F1F5F9]">
            Instabilidade Crítica no Sistema
          </h2>

          <p className="mt-2 text-xs text-[#94A3B8] leading-relaxed">
            Ocorreu uma exceção inesperada de inicialização. O evento foi registrado no servidor.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="rounded-xl bg-[#00D2FF] px-4 py-2 text-xs font-bold text-[#0A0D17] hover:bg-[#00B4DB] transition-colors"
            >
              Tentar Novamente
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") window.location.href = "/";
              }}
              className="rounded-xl border border-[#2A354D] bg-[#1E2638] px-4 py-2 text-xs font-semibold text-[#F1F5F9] hover:border-[#00D2FF]/40 transition-colors"
            >
              Ir para o Início
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
