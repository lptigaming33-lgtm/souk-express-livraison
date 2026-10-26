import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SOUK EXPRESS — Livraison Rapide Agadir (Maroc)",
  description:
    "Application PWA de livraison à Agadir : Restaurants, Souk El Had, Boulangeries et Courses livrés en 25 min par notre flotte moto. Paiement Cash à la livraison (MAD).",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Souk Express",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5A00",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-[#F8F7F4] text-[#111111] antialiased selection:bg-[#FF5A00] selection:text-white">
        {children}
      </body>
    </html>
  );
}
