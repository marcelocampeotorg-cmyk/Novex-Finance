import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#06B6D4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "NOVEX Finance — Gestão Financeira Pessoal",
  description: "Sistema financeiro pessoal automatizado com conciliação Mercado Pago e parcelamentos.",
  manifest: "/manifest.json",
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
        {children}
      </body>
    </html>
  );
}
