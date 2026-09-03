import type { Metadata, Viewport } from "next";
import { Manrope, Fraunces } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { installPromptCapture } from "@/components/pwa/install-prompt-capture";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// The workhorse: every label, figure and field. Manrope carries the data layer — open,
// even, excellent tabular figures for engine hours and amounts, legible at 16 px in full sun.
// Self-hosted by next/font (no runtime Google dependency), so the PWA reads the same offline.
const sans = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-var",
  weight: ["400", "500", "600", "700", "800"],
});

// The brand voice: only the display layer — the wordmark, the big screen titles, the empty
// states, the login. Fraunces is the logbook's soul over Manrope's instrument precision;
// `font-optical-sizing: auto` keeps it elegant at size and sturdy at rest.
const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-var",
  style: ["normal", "italic"],
});

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
    <html lang={locale} className={`${sans.variable} ${display.variable} h-full antialiased`}>
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
