"use client";

import React, { useState } from "react";
import { RefreshCw, Plus, Search, CheckCircle2, AlertTriangle, User, LogOut } from "lucide-react";

import { NewAccountModal } from "@/components/ui/NewAccountModal";
import { authClient } from "@/lib/auth-client";

interface AppTopbarProps {
  onOpenMobileMenu?: () => void;
}

export const AppTopbar: React.FC<AppTopbarProps> = ({ onOpenMobileMenu }) => {
  const { data: session } = authClient.useSession();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [summary, setSummary] = useState<{ syncSource: string; accountDisplayName: string; lastSyncAt: string | null; role: string } | null>(null);

  React.useEffect(() => {
    import("@/server/actions/workspace").then(({ getWorkspaceSummary }) => {
      getWorkspaceSummary().then((res) => {
        if (res.success) {
          setSummary({
            syncSource: res.syncSource,
            accountDisplayName: res.accountDisplayName,
            lastSyncAt: res.lastSyncAt,
            role: res.role,
          });
        }
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
      await triggerMercadoPagoSync(true);
      const res = await getWorkspaceSummary();
      setSummary({
        syncSource: res.syncSource || "Desconectado",
        accountDisplayName: res.accountDisplayName || "Não conectado",
        lastSyncAt: res.lastSyncAt || "",
        role: res.role || "MEMBER",
      });
      const { notifyStoreChange } = await import("@/services/financial-store");
      notifyStoreChange();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 sm:h-16 w-full items-center justify-between border-b border-novex-border bg-novex-surface1/90 px-3 sm:px-6 backdrop-blur-md pt-safe">
        {/* Esquerda: Botão Hamburger Mobile + Logo Mobile + Busca Desktop */}
        <div className="flex items-center gap-2.5 sm:gap-4 flex-1 max-w-md">
          {/* Botão Hamburger (exibido apenas em smartphones) */}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden flex items-center justify-center p-2 rounded-xl text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2 active:scale-95 transition-colors"
            aria-label="Abrir menu de navegação"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo compacto apenas para smartphones */}
          <div className="md:hidden flex items-center gap-1.5 shrink-0">
            <span className="text-sm font-black text-slate-100">NOVEX</span>
            <span className="text-sm font-black text-novex-cyan">BR</span>
          </div>

          {/* Barra de Pesquisa Global (em desktop/tablet) */}
          <div className="relative w-full hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-novex-text-muted" />
            <input
              type="text"
              placeholder="Buscar favorecido, conta, valor..."
              className="w-full rounded-lg border border-novex-border bg-novex-bg py-2 pl-9 pr-4 text-xs text-novex-text-primary placeholder-novex-text-muted focus:border-novex-cyan focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Direita: Ação Rápida e Perfil */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Botão Rápido + Nova Conta (texto completo em desktop, compacto em smartphone) */}
          <button
            onClick={() => setIsNewAccountOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-novex-cyan px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-novex-bg hover:bg-novex-cyan-hover active:scale-95 transition-all shadow-sm glow-cyan-subtle"
            aria-label="Nova Conta"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Nova Conta</span>
          </button>

          {/* Avatar Usuário */}
          <div className="flex items-center gap-2 sm:gap-3 border-l border-novex-border pl-2.5 sm:pl-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-novex-surface2 text-novex-cyan border border-novex-cyan/30">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-semibold text-novex-text-primary">
                {session?.user?.name || session?.user?.email || "Usuário"}
              </span>
              <span className="text-[10px] text-novex-text-muted">
                {summary?.role === "OWNER" ? "Proprietário" : summary?.role === "ADMIN" ? "Administrador" : "Membro"}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded p-1.5 text-novex-text-muted hover:bg-red-500/10 hover:text-red-400 transition-colors hidden sm:inline-flex"
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
