import type { Metadata } from "next";
import Link from "next/link";
import {
  AnchorIcon,
  CheckIcon,
  ClipboardCheckIcon,
  FileSpreadsheetIcon,
  NotebookPenIcon,
  UsersIcon,
  WalletIcon,
  WifiOffIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AppPreview } from "@/components/marketing/AppPreview";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
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
 *
 * Since D122 it carries two audiences rather than one. The owner reads it top to bottom and
 * opens a free carnet; the shipyard recognises itself in one band and leaves for
 * `/constructeurs`. The two paths section is the page's spine: same application, same screens,
 * and the only difference is who fills the carnet on the first day.
 */
export default async function HomePage() {
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
  const points = ["one", "two", "three"] as const;

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {/* Hero — the brand band carries the navigation, the promise and a drawn dashboard. */}
      <div className="bg-header-gradient text-on-navy">
        <MarketingHeader current="home" />

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
                <Link href="/constructeurs">{t("hero.secondary")}</Link>
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

      {/* The problem, said plainly and once — now from both sides of the handover. */}
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

      {/* The two ways in (D122). Two cards, side by side, deliberately the same height and the
          same vocabulary: what the shipyard sells is not another product, it is the first day. */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
        <h2 className="text-h1">{t("paths.title")}</h2>
        <p className="mt-3 max-w-2xl text-body-lg text-ink-2">{t("paths.subtitle")}</p>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {(["free", "service"] as const).map((path) => (
            <div
              key={path}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm"
            >
              <span className="w-fit rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-caption font-medium text-ink-2">
                {t(`paths.${path}.badge`)}
              </span>
              <h3 className="text-h2">{t(`paths.${path}.title`)}</h3>
              <p className="text-body text-ink-2">{t(`paths.${path}.body`)}</p>
              <ul className="flex flex-col gap-2">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-body text-foreground">
                    <CheckIcon className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden />
                    <span>{t(`paths.${path}.${point}`)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-auto border-t border-border pt-4 text-caption text-ink-2">
                {t(`paths.${path}.foot`)}
              </p>
              {path === "service" ? (
                <>
                  <p className="text-caption text-ink-2">{t("paths.service.soon")}</p>
                  <Button asChild size="xl" variant="outline" className="w-full sm:w-fit">
                    <Link href="/constructeurs">{t("paths.service.cta")}</Link>
                  </Button>
                </>
              ) : (
                <Button asChild size="xl" className="w-full sm:w-fit">
                  <Link href="/signup">{t("paths.free.cta")}</Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface-2">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
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
        </div>
      </section>

      {/* The shipyard's door, as a card rather than a band: the page belongs to the owner, and a
          second full-width navy surface before the closing one would read as two endings. */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-4 rounded-2xl bg-header-gradient p-8 text-on-navy lg:p-10">
          <p className="text-overline text-brass-light uppercase">{t("builderCard.eyebrow")}</p>
          <h2 className="max-w-2xl text-h1 text-balance">{t("builderCard.title")}</h2>
          <p className="max-w-2xl text-body-lg text-on-navy-2">{t("builderCard.body")}</p>
          <Button asChild size="xl" variant="secondary" className="w-full sm:w-fit">
            <Link href="/constructeurs">{t("builderCard.cta")}</Link>
          </Button>
        </div>
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

      <MarketingFooter />
    </main>
  );
}
