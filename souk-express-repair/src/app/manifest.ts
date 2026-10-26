import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SOUK EXPRESS — Livraison Agadir",
    short_name: "Souk Express",
    description:
      "Livraison rapide à Agadir (Talborjt, Souk El Had, Hay Dakhla, Founty). Restaurants, Souk & Courses payables Cash à la livraison (MAD).",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F7F4",
    theme_color: "#FF5A00",
    orientation: "portrait",
    lang: "fr-MA",
    dir: "auto",
    categories: ["food", "shopping", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
