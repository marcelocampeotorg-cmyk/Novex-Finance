"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-novex-bg">
      {/* Desktop Sidebar (oculta em smartphones < md) */}
      <div className="hidden md:block shrink-0">
        <AppSidebar />
      </div>

      {/* Mobile Navigation Drawer deslizante */}
      <MobileNavDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
      />

      {/* Área Principal de Conteúdo */}
      <div className="flex flex-1 flex-col overflow-x-hidden min-w-0">
        {/* Topbar Global com botão de menu para smartphone */}
        <AppTopbar onOpenMobileMenu={() => setMobileDrawerOpen(true)} />

        {/* Conteúdo da Página: padding compacto em smartphone (p-3.5 sm:p-5), espaçamento para bottom nav (pb-28 md:pb-8) */}
        <main className="flex-1 p-3.5 sm:p-5 md:p-8 pb-28 md:pb-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Barra de Navegação Inferior para Smartphones (iPhone & Android) */}
      <MobileBottomNav onOpenMore={() => setMobileDrawerOpen(true)} />
    </div>
  );
}
