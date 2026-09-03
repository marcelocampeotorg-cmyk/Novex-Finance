"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Bell,
  BarChart3,
  Settings,
  Trash2,
  X,
  User,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/formatters";
import { authClient } from "@/lib/auth-client";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const allNavItems = [
  { label: "Início (Dashboard)", href: "/", icon: LayoutDashboard },
  { label: "Contas a Pagar", href: "/contas-a-pagar", icon: ArrowUpRight },
  { label: "Contas a Receber", href: "/contas-a-receber", icon: ArrowDownLeft },
  { label: "Movimentações", href: "/movimentacoes", icon: ArrowRightLeft },
  { label: "Lembretes & Alertas", href: "/lembretes", icon: Bell },
  { label: "Relatórios & DRE", href: "/relatorios", icon: BarChart3 },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
  { label: "Lixeira", href: "/lixeira", icon: Trash2 },
];

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [workspaceInfo, setWorkspaceInfo] = React.useState<{ workspaceName: string; mpStatus: string } | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      import("@/server/actions/workspace").then(({ getWorkspaceSummary }) => {
        getWorkspaceSummary().then((res) => {
          if (res.success) {
            setWorkspaceInfo({
              workspaceName: res.workspaceName || "Workspace",
              mpStatus: res.mpStatus === "CONNECTED"
                ? `Mercado Pago (${res.mpEnv === "PRODUCTION" ? "Produção" : "Sandbox"})`
                : "Mercado Pago Desconectado",
            });
          }
        });
      });
    }
  }, [isOpen]);

  // Bloquear scroll do body quando o drawer estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex" aria-modal="true" role="dialog">
      {/* Backdrop fosco */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Gaveta lateral deslizante */}
      <div className="relative w-[85%] max-w-[320px] bg-novex-surface1 border-r border-novex-border flex flex-col h-full shadow-2xl z-10 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),16px)] animate-in slide-in-from-left duration-250 ease-out">
        {/* Topo do Drawer com Logo e Botão Fechar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-novex-border/80">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/novex_symbol_original.png"
              alt="NOVEXBR"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
            <div className="flex flex-col">
              <div className="flex items-baseline leading-none">
                <span className="text-base font-black tracking-wider text-slate-100">NOVEX</span>
                <span className="text-base font-black tracking-wider text-novex-cyan">BR</span>
              </div>
              <span className="text-[8px] font-bold tracking-widest text-novex-cyan/80 uppercase mt-0.5">
                Finance
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2 active:scale-95 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informação do Workspace */}
        {workspaceInfo && (
          <div className="px-5 py-3 bg-novex-surface2/40 border-b border-novex-border/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-novex-text-primary truncate max-w-[180px]">
              {workspaceInfo.workspaceName}
            </span>
            <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>Conectado</span>
            </span>
          </div>
        )}

        {/* Lista de Navegação com scroll suave */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {allNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors select-none min-h-[44px]",
                  isActive
                    ? "bg-novex-cyan/15 text-novex-cyan font-bold border border-novex-cyan/30"
                    : "text-novex-text-secondary hover:text-novex-text-primary hover:bg-novex-surface2/60 active:bg-novex-surface2"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-novex-cyan" : "text-novex-text-muted")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé do Drawer com Usuário e Logout */}
        <div className="border-t border-novex-border/80 px-4 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-novex-surface2 text-novex-cyan border border-novex-cyan/30 shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-novex-text-primary truncate">
                {session?.user?.name || session?.user?.email || "Usuário"}
              </span>
              <span className="text-[10px] text-novex-text-muted truncate">
                {session?.user?.email}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 active:scale-95 transition-colors shrink-0"
            title="Sair da Conta"
            aria-label="Sair da Conta"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
