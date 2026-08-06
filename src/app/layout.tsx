import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopbar } from "@/components/layout/AppTopbar";

export const metadata: Metadata = {
  title: "NOVEX Finance — Gestão Financeira Pessoal",
  description: "Sistema financeiro pessoal automatizado com conciliação Mercado Pago e parcelamentos.",
  icons: {
    icon: "/brand/novex_symbol_original.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-novex-bg text-novex-text-primary antialiased">
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
      </body>
    </html>
  );
}
