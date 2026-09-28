import type { Metadata } from "next";
import Link from "next/link";
import { CompassIcon, HouseIcon, UsersIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { XamanLogotype } from "@/components/brand/XamanLogotype";
import { BrochureRail } from "@/components/marketing/brochure/BrochureRail";
import { BrochureSlide } from "@/components/marketing/brochure/BrochureSlide";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Button } from "@/components/ui/button";

const TOTAL = 4;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.brochure.meta");
  return { title: { absolute: t("title") }, description: t("description") };
}

/**
 * The builders' presentation, read on the site rather than sent as a PDF (E19-10, E19-12, D155).
 *
 * Four pages that sell a call: what Xaman is and who builds it, MyFrank's own numbers, what the
 * logbook changes for a yard's after-sales service, and a thirty-minute call with a pilot at the
 * end of it. The seven pages it replaced argued the yard's business back to it and read as
 * machine-written; these say what we have and what we want, and nothing about the reader they
 * have not been told.
 *
 * MyFrank's figures (300+ companies, 4,9/5) are the ones myfrank.io publishes; the 400 points of
 * sale are the team's own count. Keep the three in step with the site before each send.
 *
 * There is no way back to `/constructeurs` from here: the brochure is sent on its own, as a
 * link, to someone who has not seen the offer page, and a second button beside « Réserver un
 * appel » only gives them somewhere else to go.
 *
 * Re-drawn with the tokens of `globals.css` rather than embedded as a PDF: a flattened raster has
 * no selectable text, nothing a screen reader can read, and is a second copy of a design that
 * already lives in the app.
 */
export default async function BrochurePage() {
  const t = await getTranslations("marketing.brochure");
  const tNav = await getTranslations("marketing.nav");
  const tBuilders = await getTranslations("marketing.builders");
  const source = t("footer");

  const pages = Array.from({ length: TOTAL }, (_, i) => i + 1);
  const goTo = pages.map((number) => t("nav.goTo", { number }));
  const position = pages.map((number) => t("nav.position", { number, total: TOTAL }));

  // The same letterbox the builders' page cites (E19-9), read from the same key rather than
  // written twice: it does not exist yet, and the day it is created it is created once.
  const mailto = `mailto:${tBuilders("cta.email")}?subject=${encodeURIComponent(
    t("four.ctaSubject"),
  )}`;

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {/*
        Printing, in one rule. `@page` is document-wide with no way to scope it to a class, so it
        lives here rather than in `globals.css`: this element exists only while the brochure is
        the page being rendered, and the report's own printouts (E9-2b, E18-5) keep their
        portrait box. The `zoom` is what makes a page of the web brochure fit a page of paper —
        one proportional reduction instead of a dozen `print:` variants on paddings, titles and
        cards.
      */}
      <style>{"@media print{@page{size:A4 landscape;margin:10mm}.brochure-page{zoom:0.78}}"}</style>

      <div className="sticky top-0 z-30 border-b border-on-navy-border bg-navy/95 text-on-navy backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 safe-pt-2 pb-2 lg:px-8">
          <Link
            href="/"
            aria-label={tNav("home")}
            className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-brass-light/60"
          >
            <XamanLogotype className="h-7" />
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------- 1 */}
      <BrochureSlide
        index={1}
        total={TOTAL}
        tone="navy"
        level={1}
        eyebrow={t("one.eyebrow")}
        title={t("one.title")}
        source={source}
      >
        <div className="flex max-w-3xl flex-col gap-8">
          <p className="text-body-lg text-on-navy-2">{t("one.lead")}</p>
          <div className="flex flex-col gap-2 border-l-2 border-brass-light pl-4">
            <p className="text-overline text-brass-light uppercase">{t("one.byLabel")}</p>
            <p className="text-body text-on-navy">{t("one.byBody")}</p>
          </div>
        </div>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 2 */}
      <BrochureSlide
        index={2}
        total={TOTAL}
        tone="paper"
        eyebrow={t("two.eyebrow")}
        title={t("two.title")}
        source={source}
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          {(["One", "Two", "Three"] as const).map((n) => (
            <div
              key={n}
              className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-5 shadow-sm lg:p-6"
            >
              <dt className="order-2 text-body text-ink-2">
                {t(`two.stat${n}Label` as "two.statOneLabel")}
              </dt>
              <dd className="order-1 m-0 font-display num text-[2.5rem] leading-none font-semibold tracking-tight text-foreground lg:text-[3.25rem]">
                {t(`two.stat${n}Value` as "two.statOneValue")}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex max-w-3xl flex-col gap-3">
          <p className="text-body-lg text-ink-2">{t("two.body")}</p>
          <a
            href="https://myfrank.io"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 w-fit items-center text-label font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {t("two.site")}
          </a>
        </div>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 3 */}
      <BrochureSlide
        index={3}
        total={TOTAL}
        tone="paper"
        eyebrow={t("three.eyebrow")}
        title={t("three.title")}
        source={source}
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-10">
          <ul className="flex flex-col gap-5">
            {[
              { key: "owner", Icon: UsersIcon },
              { key: "yard", Icon: HouseIcon },
              { key: "market", Icon: CompassIcon },
            ].map(({ key, Icon }) => (
              <li key={key} className="flex items-start gap-3">
                <Icon className="mt-1 size-5 shrink-0 text-ink-2" aria-hidden />
                <div className="min-w-0">
                  <h3 className="text-h2">{t(`three.${key}Title` as "three.ownerTitle")}</h3>
                  <p className="mt-1 text-body text-ink-2">
                    {t(`three.${key}Body` as "three.ownerBody")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <CarnetCard />
        </div>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 4 */}
      <BrochureSlide
        index={4}
        total={TOTAL}
        tone="navy"
        eyebrow={t("four.eyebrow")}
        title={t("four.title")}
        source={source}
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <p className="text-body-lg text-on-navy-2">{t("four.lead")}</p>
          <div className="flex flex-col gap-3">
            <p className="text-overline text-brass-light uppercase">{t("four.askLabel")}</p>
            <ol className="flex flex-col divide-y divide-on-navy-border border-y border-on-navy-border">
              {(["One", "Two", "Three"] as const).map((n, i) => (
                <li key={n} className="flex items-baseline gap-4 py-3">
                  <span aria-hidden className="w-5 shrink-0 num text-label text-brass-light">
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-body text-on-navy">
                    {t(`four.ask${n}` as "four.askOne")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-on-navy-border pt-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild size="xl" variant="secondary">
              <a href={mailto}>{t("four.ctaButton")}</a>
            </Button>
            <span className="text-label text-brass-light">{t("four.site")}</span>
          </div>
          <p className="text-caption text-on-navy-3">{t("pilot")}</p>
        </div>
      </BrochureSlide>

      <BrochureRail
        total={TOTAL}
        label={t("nav.label")}
        goTo={goTo}
        position={position}
        print={t("nav.print")}
      />
      {/* The site's foot belongs to the site, not to the deck: printed, it would open a fifth
          page under four. */}
      <div className="print:hidden">
        <MarketingFooter />
      </div>
    </main>
  );
}

/** Page 3's carnet: the same three lines as the home page's preview, drawn on paper. */
async function CarnetCard() {
  const t = await getTranslations("marketing");

  const lines = [
    {
      title: t("preview.lineOne"),
      meta: t("preview.lineOneMeta"),
      badge: t("preview.overdue"),
      tone: "border-state-overdue-border bg-state-overdue-tint text-state-overdue-fg",
    },
    {
      title: t("preview.lineTwo"),
      meta: t("preview.lineTwoMeta"),
      badge: t("preview.soon"),
      tone: "border-state-soon-border bg-state-soon-tint text-state-soon-fg",
    },
    {
      title: t("preview.lineThree"),
      meta: t("preview.lineThreeMeta"),
      badge: t("preview.ok"),
      tone: "border-state-ok-border bg-state-ok-tint text-state-ok-fg",
    },
  ];

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <p className="text-label text-foreground">{t("brochure.three.boat")}</p>
        </div>
        <ul className="divide-y divide-border">
          {lines.map((line) => (
            <li key={line.title} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-label text-foreground">{line.title}</p>
                <p className="mt-0.5 text-caption text-ink-2">{line.meta}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-caption font-medium ${line.tone}`}
              >
                {line.badge}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-caption text-ink-3">{t("brochure.three.caption")}</figcaption>
    </figure>
  );
}
