"use client";

import React, { useState } from "react";
import { RefreshCw, Plus, Search, CheckCircle2, User, LogOut } from "lucide-react";

import { NewAccountModal } from "@/components/ui/NewAccountModal";
import { authClient } from "@/lib/auth-client";

export const AppTopbar: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [summary, setSummary] = useState<{ syncSource: string; accountDisplayName: string; lastSyncAt: string } | null>(null);

  React.useEffect(() => {
    import("@/server/actions/workspace").then(({ getWorkspaceSummary }) => {
      getWorkspaceSummary().then((res) => {
        setSummary({
          syncSource: res.syncSource,
          accountDisplayName: res.accountDisplayName,
          lastSyncAt: res.lastSyncAt,
        });
      });
    });
  }, []);

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { triggerMercadoPagoSync, getWorkspaceSummary } = await import("@/server/actions/workspace");
      await triggerMercadoPagoSync();
      const res = await getWorkspaceSummary();
      setSummary({
        syncSource: res.syncSource,
        accountDisplayName: res.accountDisplayName,
        lastSyncAt: res.lastSyncAt,
      });
      window.location.reload(); // Atualiza toda a tela para refletir o novo saldo
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-novex-border bg-novex-surface1/90 px-6 backdrop-blur-md">
        {/* Barra de Pesquisa Global */}
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
            <input
              type="text"
              placeholder="Buscar favorecido, conta, valor ou palavra-chave..."
              className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 pl-9 pr-4 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Direita: Status de Sync, Ação Rápida e Perfil */}
        <div className="flex items-center gap-4">
          {/* Status de Sincronização Mercado Pago */}
          <div className="hidden sm:flex items-center gap-2.5 rounded-lg border border-novex-border bg-novex-surface2/80 px-3 py-1.5 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {summary && (
              <div className="flex flex-col">
                <span className="font-medium text-novex-text-primary text-[11px]">
                  {summary.syncSource}
                </span>
                <span className="text-[10px] text-novex-text-muted">
                  {summary.accountDisplayName}
                </span>
              </div>
            )}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="ml-1 rounded p-1 text-novex-text-secondary hover:bg-novex-border hover:text-novex-cyan transition-colors"
              title="Sincronizar movimentações do Mercado Pago agora"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-novex-cyan" : ""}`} />
            </button>
          </div>

          {/* Botão Rápido + Nova Conta */}
          <button
            onClick={() => setIsNewAccountOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-novex-cyan px-4 py-2 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover transition-colors shadow-sm glow-cyan-subtle"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Nova Conta</span>
          </button>

          {/* Avatar Usuário */}
          <div className="flex items-center gap-3 border-l border-novex-border pl-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-novex-surface2 text-novex-cyan border border-novex-cyan/30">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-semibold text-novex-text-primary">Frank</span>
              <span className="text-[10px] text-novex-text-muted">Proprietário</span>
            </div>
            <button
              onClick={handleLogout}
              className="ml-1 rounded p-1.5 text-novex-text-muted hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="Sair do sistema"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Modal Global de Nova Conta */}
      <NewAccountModal
        isOpen={isNewAccountOpen}
        onClose={() => setIsNewAccountOpen(false)}
      />
    </>
  );
};
