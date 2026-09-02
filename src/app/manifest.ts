import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";

// Served at /manifest.webmanifest (BACKLOG E0-6).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("app");

  return {
    id: "/",
    name: t("name"),
    short_name: t("name"),
    description: t("tagline"),
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0C1B33",
    theme_color: "#0C1B33",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
