import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/ui/toaster";
import { SITE_URL } from "@/lib/env";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Casa de Filadélfia",
    template: "%s · Casa de Filadélfia",
  },
  description:
    "Loja da Casa de Filadélfia — peça pelo celular, pague na entrega e acompanhe seu pedido.",
  applicationName: "Casa de Filadélfia",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Filadélfia" },
  formatDetection: { telephone: false },
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>
        {children}
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
