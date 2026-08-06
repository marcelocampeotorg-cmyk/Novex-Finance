"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Settings, ShieldCheck, RefreshCw, Key, Database, Check } from "lucide-react";
import { MOCK_BALANCE_SUMMARY } from "@/mocks/financial-data";

export default function ConfiguracoesPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Configurações do Sistema"
        description="Parâmetros do Workspace, integração com Mercado Pago e regras de segurança."
      />

      <div className="max-w-3xl space-y-6">
        {/* Workspace */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-novex-border pb-3">
            <Settings className="h-5 w-5 text-novex-cyan" />
            <h3 className="text-base font-bold text-novex-text-primary">Dados do Workspace</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Nome do Workspace</label>
              <input
                type="text"
                defaultValue="Workspace Pessoal — Frank"
                className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary focus:border-novex-cyan focus:outline-none"
              />
            </div>
            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Fuso Horário Padrão</label>
              <input
                type="text"
                disabled
                defaultValue="America/Sao_Paulo (UTC-3)"
                className="w-full rounded-lg border border-novex-border bg-novex-surface2 p-2.5 text-novex-text-muted cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Integração Mercado Pago */}
        <div className="rounded-xl border border-novex-border bg-novex-surface1 p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-novex-border pb-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-novex-text-primary">Integração Mercado Pago</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-novex-surface2 p-3 border border-novex-border/60">
              <div>
                <span className="font-bold text-novex-text-primary block">{MOCK_BALANCE_SUMMARY.accountDisplayName}</span>
                <span className="text-[10px] text-novex-text-muted">Status: Conectado • Autenticação via Token de Produção</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold text-[11px]">
                Ativo
              </span>
            </div>

            <div>
              <label className="font-semibold text-novex-text-secondary block mb-1">Access Token Mercado Pago</label>
              <div className="relative">
                <input
                  type="password"
                  defaultValue="APP_USR-89421049210948210948210948"
                  className="w-full rounded-lg border border-novex-border bg-novex-bg p-2.5 text-novex-text-primary font-mono focus:border-novex-cyan focus:outline-none"
                />
                <Key className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-novex-text-muted" />
              </div>
              <span className="text-[10px] text-novex-text-muted mt-1 block">
                Criptografado em repouso com AES-256 no banco de dados. Nunca exposto no navegador.
              </span>
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 rounded-lg bg-novex-cyan hover:bg-novex-cyan-hover text-novex-bg px-6 py-2.5 font-semibold text-xs transition-colors shadow-sm glow-cyan-subtle"
        >
          {saved ? <Check className="h-4 w-4" /> : null}
          <span>{saved ? "Alterações Salvas!" : "Salvar Configurações"}</span>
        </button>
      </div>
    </div>
  );
}
