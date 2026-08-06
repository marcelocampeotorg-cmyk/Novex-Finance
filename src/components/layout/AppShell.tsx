"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <main className="min-h-screen bg-[#0B0E14]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar Global */}
      <AppSidebar />

      {/* Área Principal de Conteúdo */}
      <div className="flex flex-1 flex-col overflow-x-hidden min-w-0">
        {/* Topbar Global */}
        <AppTopbar />

        {/* Conteúdo da Página */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
