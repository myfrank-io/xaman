import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CompassIcon,
  HouseIcon,
  NotebookTextIcon,
  StarIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { XamanLogotype } from "@/components/brand/XamanLogotype";
import { BrochureNote } from "@/components/marketing/brochure/BrochureNote";
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
 * Four pages, where there were seven. The seven argued — the cost of the handshake, the car
 * analogy, a quote, two buyers, a pilot — and a prospect read them as something a machine had
 * written: seven pages of conclusions about a business we have never been told about. Which they
 * were. So the deck no longer argues: it says who we are, what we have already built elsewhere,
 * what we would like to try in the marine trade, and asks for thirty minutes in which the yard
 * does the talking. Everything a call is supposed to establish — their process, what warranty
 * costs them, what their owners ask for — is now a question on page 4 instead of an answer on
 * pages 2, 3 and 6.
 *
 * Two liabilities left with those pages, and both were flagged before they did: the *Figaro
 * Nautisme* quote nobody could verify at the source, and a cover that called Xaman the first
 * digital logbook in yachting with nothing to back it.
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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 safe-pt-2 pb-2 lg:px-8">
          <Link
            href="/"
            aria-label={tNav("home")}
            className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-brass-light/60"
          >
            <XamanLogotype className="h-7" />
          </Link>
          {/* « Revenir à l'offre constructeur » is 221 px of label: beside the logotype it runs
              off a 320 px screen, so below `sm` it is the arrow alone and the words move to the
              accessible name. 44 x 44 either way. */}
          <Link
            href="/constructeurs"
            aria-label={t("nav.back")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-label text-on-navy outline-none hover:bg-on-navy-surface focus-visible:ring-[3px] focus-visible:ring-brass-light/60"
          >
            <ArrowLeftIcon className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t("nav.back")}</span>
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
        note={
          <BrochureNote icon={<UsersIcon className="size-5" />} title={t("two.noteTitle")}>
            <p className="text-body text-on-navy-2">{t("two.noteBody")}</p>
          </BrochureNote>
        }
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { key: "reviews", Icon: StarIcon },
            { key: "service", Icon: WrenchIcon },
            { key: "xaman", Icon: NotebookTextIcon },
          ].map(({ key, Icon }) => (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <p className="flex items-center gap-2 text-overline text-brass uppercase">
                <Icon className="size-4 text-ink-2" aria-hidden />
                {t(`two.${key}Label` as "two.reviewsLabel")}
              </p>
              <p className="text-body text-ink-2">{t(`two.${key}Body` as "two.reviewsBody")}</p>
            </li>
          ))}
        </ul>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 3 */}
      <BrochureSlide
        index={3}
        total={TOTAL}
        tone="paper"
        eyebrow={t("three.eyebrow")}
        title={t("three.title")}
        source={source}
        note={
          <BrochureNote icon={<CompassIcon className="size-5" />} title={t("three.noteTitle")} />
        }
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
          <div className="flex flex-col gap-4">
            <p className="text-overline text-brass-light uppercase">{t("four.askLabel")}</p>
            <ol className="flex flex-col gap-3">
              {(["One", "Two", "Three"] as const).map((n, i) => (
                <li
                  key={n}
                  className="flex items-start gap-4 rounded-xl border border-on-navy-border bg-on-navy-surface/70 px-4 py-4"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-brass-light num text-caption font-medium text-brass-light"
                  >
                    {i + 1}
                  </span>
                  <p className="min-w-0 text-body text-on-navy">
                    {t(`four.ask${n}` as "four.askOne")}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-body-lg text-on-navy-2 lg:self-center">{t("four.closing")}</p>
        </div>

        <div className="flex flex-col gap-4 border-t border-on-navy-border pt-6">
          <p className="text-caption text-on-navy-3">{t("pilot")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="xl" variant="secondary">
              <a href={mailto}>{t("four.ctaButton")}</a>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-on-navy-border bg-transparent text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
            >
              <Link href="/constructeurs">{t("nav.back")}</Link>
            </Button>
            <span className="text-label text-brass-light">{t("four.site")}</span>
          </div>
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
