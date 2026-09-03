import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { installPromptCapture } from "@/components/pwa/install-prompt-capture";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("tagline"),
    applicationName: t("name"),
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: t("name") },
    formatDetection: { telephone: false },
    other: {
      // `appleWebApp.capable` only emits the modern `mobile-web-app-capable`, which iOS ignores.
      // Safari reads the manifest first, but falls back to this tag when it cannot (a slow or
      // failed manifest fetch on a phone connection) — and without it « Sur l'écran d'accueil »
      // gives a bookmark that opens in Safari with the address bar instead of the app.
      "apple-mobile-web-app-capable": "yes",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0C1B33",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} className="h-full antialiased">
      <head>
        {/* Inline and first: Chrome fires `beforeinstallprompt` once, before hydration. */}
        <script dangerouslySetInnerHTML={{ __html: installPromptCapture }} />
      </head>
      <body className="flex min-h-full min-w-0 flex-col font-sans">
        <NextIntlClientProvider>
          <PwaProvider>{children}</PwaProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
