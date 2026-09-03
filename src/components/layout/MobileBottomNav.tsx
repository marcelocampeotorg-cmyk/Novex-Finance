"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/formatters";

interface MobileBottomNavProps {
  onOpenMore: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMore }) => {
  const pathname = usePathname();

  const navItems = [
    { label: "Início", href: "/", icon: LayoutDashboard },
    { label: "Pagar", href: "/contas-a-pagar", icon: ArrowUpRight },
    { label: "Receber", href: "/contas-a-receber", icon: ArrowDownLeft },
    { label: "Extrato", href: "/movimentacoes", icon: ArrowRightLeft },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-novex-surface1/95 border-t border-novex-border/80 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),10px)] pt-2 px-2"
      aria-label="Navegação móvel inferior"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-200 select-none min-h-[44px]",
                isActive
                  ? "text-novex-cyan font-bold"
                  : "text-novex-text-secondary hover:text-novex-text-primary active:scale-95"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center p-1 rounded-lg transition-transform",
                isActive ? "bg-novex-cyan/15 scale-110 shadow-sm shadow-novex-cyan/20" : ""
              )}>
                <Icon className={cn("h-5 w-5", isActive ? "stroke-[2.5]" : "stroke-[1.8]")} />
              </div>
              <span className={cn(
                "text-[10px] mt-1 tracking-tight leading-none",
                isActive ? "font-bold text-novex-cyan" : "font-medium"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Botão 'Mais' para abrir menu completo */}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex flex-col items-center justify-center py-1 px-1 rounded-xl text-novex-text-secondary hover:text-novex-text-primary active:scale-95 transition-all duration-200 select-none min-h-[44px]"
          aria-label="Abrir menu com mais opções"
        >
          <div className="flex items-center justify-center p-1 rounded-lg">
            <Menu className="h-5 w-5 stroke-[1.8]" />
          </div>
          <span className="text-[10px] mt-1 tracking-tight leading-none font-medium">
            Mais
          </span>
        </button>
      </div>
    </nav>
  );
};
