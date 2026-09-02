import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
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
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>
          <PwaProvider>{children}</PwaProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
