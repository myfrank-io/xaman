import type { Metadata } from "next";
import Link from "next/link";
import {
  AnchorIcon,
  ClipboardCheckIcon,
  FileSpreadsheetIcon,
  NotebookPenIcon,
  UsersIcon,
  WalletIcon,
  WifiOffIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { XamanLogotype } from "@/components/brand/XamanLogotype";
import { AppPreview } from "@/components/marketing/AppPreview";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const ta = await getTranslations("app");
  const tm = await getTranslations("marketing");
  return {
    title: { absolute: `${ta("name")} — ${ta("tagline")}` },
    description: tm("hero.subtitle"),
  };
}

/**
 * The public home page.
 *
 * Until now the root sent everyone straight to the sign-in screen, which asks a stranger to
 * identify themselves before telling them what they are signing in to. Someone signed in never
 * sees this page: `src/proxy.ts` sends them to their boats first.
 */
export default async function HomePage() {
  const ta = await getTranslations("app");
  const t = await getTranslations("marketing");

  const features = [
    { key: "log", Icon: NotebookPenIcon },
    { key: "checklist", Icon: ClipboardCheckIcon },
    { key: "shared", Icon: UsersIcon },
    { key: "money", Icon: WalletIcon },
    { key: "offline", Icon: WifiOffIcon },
    { key: "imports", Icon: FileSpreadsheetIcon },
  ] as const;

  const steps = ["one", "two", "three"] as const;

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {/* Hero — the brand band carries the navigation, the promise and a drawn dashboard. */}
      <div className="bg-header-gradient text-on-navy">
        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 safe-pt-6 lg:px-8">
          <Link
            href="/"
            aria-label={t("nav.home")}
            className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-brass-light/60"
          >
            <XamanLogotype className="h-8" />
          </Link>
          <nav className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
            >
              <Link href="/login">{t("nav.login")}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/signup">{t("nav.signup")}</Link>
            </Button>
          </nav>
        </header>

        {/* A grid item defaults to `min-width: auto`, so the widest unbroken line — the
            letter-spaced eyebrow — set the column and pushed the hero 3 px off a 320 px
            screen. `min-w-0` lets the column be the screen, and the text wrap. */}
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pt-12 pb-16 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:pt-16 lg:pb-24">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="text-overline text-brass-light uppercase">{t("hero.eyebrow")}</p>
            <h1 className="max-w-2xl text-[2rem] leading-[1.15] font-semibold tracking-tight sm:text-[2.5rem] lg:text-[3rem]">
              {t("hero.title")}
            </h1>
            <p className="max-w-xl text-body-lg text-on-navy-2">{t("hero.subtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="xl" variant="secondary">
                <Link href="/signup">{t("hero.primary")}</Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="outline"
                className="border-on-navy-border bg-transparent text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
              >
                <Link href="/login">{t("hero.secondary")}</Link>
              </Button>
            </div>
            <p className="flex items-center gap-2 text-caption text-on-navy-3">
              <AnchorIcon className="size-4 shrink-0" aria-hidden />
              {t("hero.note")}
            </p>
          </div>
          <AppPreview />
        </section>
      </div>

      {/* The problem, said plainly and once. */}
      <section className="mx-auto w-full max-w-3xl px-6 py-16 text-center lg:px-8 lg:py-20">
        <h2 className="text-h1 text-balance">{t("problem.title")}</h2>
        <p className="mt-4 text-body-lg text-ink-2">{t("problem.body")}</p>
      </section>

      <section className="border-y border-border bg-surface-2">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
          <h2 className="text-h1">{t("features.title")}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ key, Icon }) => (
              <li
                key={key}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <span className="flex size-11 items-center justify-center rounded-lg bg-navy text-on-navy">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="text-h2">{t(`features.${key}.title`)}</h3>
                <p className="text-body text-ink-2">{t(`features.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
        <h2 className="text-h1">{t("how.title")}</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="flex flex-col gap-2">
              <span className="flex size-11 items-center justify-center rounded-full border border-border-strong bg-surface text-h2 text-foreground">
                {index + 1}
              </span>
              <h3 className="text-h2">{t(`how.${step}.title`)}</h3>
              <p className="text-body text-ink-2">{t(`how.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-navy-deep text-on-navy">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-16 text-center lg:px-8 lg:py-20">
          <h2 className="text-h1 text-balance">{t("cta.title")}</h2>
          <p className="max-w-xl text-body-lg text-on-navy-2">{t("cta.body")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="xl" variant="secondary">
              <Link href="/signup">{t("cta.button")}</Link>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-on-navy-border bg-transparent text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
            >
              <Link href="/login">{t("cta.secondary")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-6 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] lg:px-8">
          <p className="text-label text-foreground">{ta("name")}</p>
          <p className="text-caption text-ink-2">{t("footer.tagline")}</p>
        </div>
      </footer>
    </main>
  );
}
