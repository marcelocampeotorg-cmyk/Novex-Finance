import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

export const viewport: Viewport = {
  themeColor: "#0B0E14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "NOVEX Finance — Gestão Financeira Pessoal",
  description: "Sistema financeiro pessoal automatizado com conciliação Mercado Pago e parcelamentos.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NOVEX Finance",
  },
  icons: {
    icon: "/brand/novex_symbol_original.png",
    apple: "/brand/novex_symbol_original.png",
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
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
