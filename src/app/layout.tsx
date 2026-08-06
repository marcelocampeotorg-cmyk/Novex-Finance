import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
