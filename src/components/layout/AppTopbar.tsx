"use client";

import React, { useState } from "react";
import { RefreshCw, Plus, Search, CheckCircle2, AlertTriangle, User, LogOut } from "lucide-react";

import { NewAccountModal } from "@/components/ui/NewAccountModal";
import { authClient } from "@/lib/auth-client";

export const AppTopbar: React.FC = () => {
  const { data: session } = authClient.useSession();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [summary, setSummary] = useState<{ syncSource: string; accountDisplayName: string; lastSyncAt: string; role: string } | null>(null);

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
              <span className="text-xs font-semibold text-novex-text-primary">
                {session?.user?.name || session?.user?.email || "Usuário"}
              </span>
              <span className="text-[10px] text-novex-text-muted">
                {summary?.role === "OWNER" ? "Proprietário" : summary?.role === "ADMIN" ? "Administrador" : "Membro"}
              </span>
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
