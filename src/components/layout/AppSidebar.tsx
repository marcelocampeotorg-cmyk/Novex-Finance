"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  ArrowRightLeft,
  Repeat,
  Bell,
  BarChart3,
  Settings,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/formatters";

export const navItems = [
  { label: "Início", href: "/", icon: LayoutDashboard },
  { label: "Contas a Pagar", href: "/contas-a-pagar", icon: ArrowUpRight },
  { label: "Contas a Receber", href: "/contas-a-receber", icon: ArrowDownLeft },
  { label: "Movimentações", href: "/movimentacoes", icon: ArrowRightLeft },
  { label: "Lembretes", href: "/lembretes", icon: Bell },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
  { label: "Lixeira", href: "/lixeira", icon: Trash2 },
];

export const AppSidebar: React.FC = () => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [workspaceInfo, setWorkspaceInfo] = useState<{ workspaceName: string; mpStatus: string } | null>(null);

  React.useEffect(() => {
    import("@/server/actions/workspace").then(({ getWorkspaceSummary }) => {
      getWorkspaceSummary().then((res) => {
        if (res.success) {
          setWorkspaceInfo({
            workspaceName: res.workspaceName || "Workspace",
            mpStatus: res.mpStatus === "CONNECTED" ? `Mercado Pago (${res.mpEnv === "PRODUCTION" ? "Produção" : "Sandbox"})` : "Mercado Pago Desconectado",
          });
        }
      });
    });
  }, []);

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-novex-border bg-novex-surface1 transition-all duration-300 z-30 min-h-screen",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Topo da Sidebar / Logo Oficial NOVEXBR */}
      <div className="flex h-16 items-center justify-between border-b border-novex-border px-4">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          {collapsed ? (
            <Image
              src="/brand/novex_symbol_original.png"
              alt="NOVEXBR"
              width={32}
              height={32}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <Image
              src="/brand/novex_logo_horizontal_original.png"
              alt="NOVEXBR Finance"
              width={160}
              height={32}
              className="h-8 w-auto max-w-[160px] object-contain"
            />
          )}
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-novex-text-secondary hover:bg-novex-surface2 hover:text-novex-cyan transition-colors"
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Navegação Principal */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group",
                isActive
                  ? "bg-novex-cyan/15 text-novex-cyan border border-novex-cyan/30 shadow-sm"
                  : "text-novex-text-secondary hover:bg-novex-surface2 hover:text-novex-text-primary"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive ? "text-novex-cyan" : "text-novex-text-muted group-hover:text-novex-text-primary"
                )}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer da Sidebar / Workspace Info */}
      <div className="border-t border-novex-border p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg bg-novex-surface2/60 p-2 border border-novex-border/40",
            collapsed ? "justify-center" : "justify-start"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-novex-cyan/20 text-novex-cyan border border-novex-cyan/40">
            <ShieldCheck className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-xs font-semibold text-novex-text-primary">
                {workspaceInfo ? workspaceInfo.workspaceName : "Carregando..."}
              </span>
              <span className="truncate text-[10px] text-novex-text-muted">
                {workspaceInfo ? workspaceInfo.mpStatus : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
