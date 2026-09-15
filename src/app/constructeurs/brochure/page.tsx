import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  HouseIcon,
  MinusIcon,
  NotebookTextIcon,
  PencilLineIcon,
  ReceiptTextIcon,
  ShieldAlertIcon,
  SquareCheckBigIcon,
  UsersIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { XamanLogotype } from "@/components/brand/XamanLogotype";
import { BrochureNote } from "@/components/marketing/brochure/BrochureNote";
import { BrochureRail } from "@/components/marketing/brochure/BrochureRail";
import { BrochureSlide } from "@/components/marketing/brochure/BrochureSlide";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Button } from "@/components/ui/button";

const TOTAL = 7;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.brochure.meta");
  return { title: { absolute: t("title") }, description: t("description") };
}

/**
 * The builders' presentation, read on the site rather than sent as a PDF (E19-10, D137).
 *
 * The deck exists as seven 16:9 pages. Re-drawn here rather than embedded: the PDF is 3.4 MB of
 * flattened raster — no selectable text, nothing a screen reader can read, four megabytes on a
 * marina's 4G, and a second copy of a design that already lives in `globals.css`. Every page
 * below is the same tokens as the app, so the brochure cannot drift from the product the way a
 * picture of it would.
 *
 * What changed from the deck on the way to a public page: the prospect it was addressed to is
 * named only where a published quote requires it (page 4, where it is the speaker's title), and
 * the pilot notice `/constructeurs` carries (E19-1) is repeated here — a yard that reads seven
 * pages of what it can sell has earned knowing what is built and what is not.
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
    t("seven.ctaSubject"),
  )}`;

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {/*
        Printing, in one rule. `@page` is document-wide with no way to scope it to a class, so it
        lives here rather than in `globals.css`: this element exists only while the brochure is
        the page being rendered, and the report's own printouts (E9-2b, E18-5) keep their
        portrait box. The `zoom` is what makes a page of the web brochure fit a page of paper —
        one proportional reduction instead of a dozen `print:` variants on paddings, titles and
        cards. Measured: seven A4 landscape pages, 830 ko, against 3.4 MB for the original deck.
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center lg:gap-10">
          <div className="flex flex-col gap-2">
            <p className="text-overline text-brass-light uppercase">{t("one.leadLabel")}</p>
            <p className="text-body-lg text-on-navy">{t("one.leadTitle")}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {[
              { key: "buyer", Icon: ShieldAlertIcon, tone: "text-state-overdue-on-dark" },
              { key: "yard", Icon: HouseIcon, tone: "text-brass-light" },
            ].map(({ key, Icon, tone }) => (
              <li
                key={key}
                className="flex items-start gap-3 rounded-xl border border-on-navy-border bg-on-navy-surface/70 px-4 py-4"
              >
                <Icon className={`mt-0.5 size-5 shrink-0 ${tone}`} aria-hidden />
                <p className="min-w-0 text-body text-on-navy-2">
                  <strong className="font-semibold text-on-navy">
                    {t(`one.${key}Who` as "one.buyerWho")}
                  </strong>{" "}
                  : {t(`one.${key}Body` as "one.buyerBody")}
                </p>
              </li>
            ))}
          </ul>
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
          <BrochureNote icon={<NotebookTextIcon className="size-5" />} title={t("two.noteTitle")}>
            <p className="text-body text-on-navy-2">{t("two.noteBody")}</p>
            <p className="text-body font-medium text-on-navy">{t("two.noteTurn")}</p>
          </BrochureNote>
        }
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { key: "doc", Icon: FileTextIcon },
            { key: "training", Icon: CalendarDaysIcon },
            { key: "after", Icon: PencilLineIcon },
          ].map(({ key, Icon }) => (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <p className="flex items-center gap-2 text-overline text-brass uppercase">
                <Icon className="size-4 text-ink-2" aria-hidden />
                {t(`two.${key}Label` as "two.docLabel")}
              </p>
              <h3 className="text-h2">{t(`two.${key}Title` as "two.docTitle")}</h3>
              <p className="text-body text-ink-2">{t(`two.${key}Body` as "two.docBody")}</p>
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
          <BrochureNote title={t("three.noteTitle")}>
            <p className="text-body text-on-navy-2">{t("three.noteBody")}</p>
          </BrochureNote>
        }
      >
        <div className="flex flex-col gap-4">
          <Timeline
            label={t("three.carLabel")}
            labelTone="text-success-fg"
            steps={[
              { title: t("three.carOne"), body: t("three.carOneBody"), lit: true },
              { title: t("three.carTwo"), body: t("three.carTwoBody") },
              { title: t("three.carThree"), body: t("three.carThreeBody") },
              { title: t("three.carFour"), body: t("three.carFourBody") },
            ]}
            litClass="bg-success"
            litText="text-success-fg"
          />
          <Timeline
            label={t("three.yardLabel")}
            labelTone="text-brass"
            steps={[
              { title: t("three.yardOne"), body: t("three.yardOneBody") },
              { title: t("three.yardTwo"), body: t("three.yardTwoBody"), lit: true },
              { title: t("three.yardThree"), body: t("three.yardThreeBody"), lit: true },
              { title: t("three.yardFour"), body: t("three.yardFourBody"), lit: true },
            ]}
            litClass="bg-state-overdue"
            litText="text-ink-2"
          />
        </div>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 4 */}
      <BrochureSlide
        index={4}
        total={TOTAL}
        tone="navy"
        eyebrow={t("four.eyebrow")}
        title={t("four.quote")}
        source={source}
      >
        <figure className="m-0">
          <figcaption className="flex flex-col gap-1 border-l-2 border-brass-light pl-4">
            <span className="text-label text-on-navy">{t("four.author")}</span>
            <span className="text-caption text-on-navy-2">{t("four.role")}</span>
            <span className="text-caption text-on-navy-3">{t("four.source")}</span>
          </figcaption>
        </figure>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 5 */}
      <BrochureSlide
        index={5}
        total={TOTAL}
        tone="paper"
        eyebrow={t("five.eyebrow")}
        title={t("five.title")}
        source={source}
        note={
          <BrochureNote
            icon={<SquareCheckBigIcon className="size-5" />}
            title={t("five.noteTitle")}
          >
            <p className="text-body text-on-navy-2">{t("five.noteBody")}</p>
          </BrochureNote>
        }
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-10">
          <ul className="flex flex-col gap-4">
            {[
              { key: "speed", Icon: FileTextIcon },
              { key: "due", Icon: ClockIcon },
              { key: "shared", Icon: UsersIcon },
            ].map(({ key, Icon }) => (
              <li key={key} className="flex items-start gap-3">
                <Icon className="mt-1 size-5 shrink-0 text-ink-2" aria-hidden />
                <div className="min-w-0">
                  <h3 className="text-h2">{t(`five.${key}Title` as "five.speedTitle")}</h3>
                  <p className="mt-1 text-body text-ink-2">
                    {t(`five.${key}Body` as "five.speedBody")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <CarnetCard />
        </div>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 6 */}
      <BrochureSlide
        index={6}
        total={TOTAL}
        tone="paper"
        eyebrow={t("six.eyebrow")}
        title={t("six.title")}
        source={source}
        note={
          <BrochureNote icon={<ReceiptTextIcon className="size-5" />} title={t("six.noteTitle")} />
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-xl bg-surface-2 p-5 lg:p-6">
            <span className="w-fit rounded-full border border-border-strong bg-surface px-3 py-1 text-caption font-medium text-ink-2">
              {t("six.withoutBadge")}
            </span>
            <h3 className="text-h1">{t("six.withoutTitle")}</h3>
            <ul className="flex flex-col gap-3">
              {(["One", "Two", "Three"] as const).map((n) => (
                <li key={n} className="flex items-start gap-3 text-body text-ink-2">
                  <MinusIcon className="mt-1 size-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0">{t(`six.without${n}` as "six.withoutOne")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-auto border-t border-border pt-4 text-body text-ink-3">
              {t("six.withoutFoot")}
            </p>
          </article>
          <article className="flex flex-col gap-4 rounded-xl border-2 border-navy bg-surface p-5 shadow-sm lg:p-6">
            <span className="w-fit rounded-full bg-navy px-3 py-1 text-caption font-medium text-on-navy">
              {t("six.withBadge")}
            </span>
            <h3 className="text-h1">{t("six.withTitle")}</h3>
            <ul className="flex flex-col gap-3">
              {(["One", "Two", "Three"] as const).map((n) => (
                <li key={n} className="flex items-start gap-3 text-body text-foreground">
                  <CheckIcon className="mt-1 size-4 shrink-0 text-brass" aria-hidden />
                  <span className="min-w-0">{t(`six.with${n}` as "six.withOne")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-auto border-t border-border pt-4 text-body font-medium text-foreground">
              {t("six.withFoot")}
            </p>
          </article>
        </div>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 7 */}
      <BrochureSlide
        index={7}
        total={TOTAL}
        tone="navy"
        eyebrow={t("seven.eyebrow")}
        title={t("seven.title")}
        source={source}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_auto_minmax(0,9fr)] lg:items-center">
          <div className="flex flex-col gap-2 rounded-xl border border-on-navy-border bg-on-navy-surface/60 px-5 py-5">
            <p className="text-overline text-on-navy-3 uppercase">{t("seven.beforeLabel")}</p>
            <p className="text-body-lg text-on-navy-2">{t("seven.beforeBody")}</p>
          </div>
          <ArrowRightIcon
            className="mx-auto size-7 rotate-90 text-brass-light lg:rotate-0"
            aria-hidden
          />
          <div className="flex flex-col gap-3 rounded-xl border border-brass-light bg-on-navy-surface/60 px-5 py-5">
            <p className="text-overline text-brass-light uppercase">{t("seven.afterLabel")}</p>
            <p className="text-body-lg text-on-navy">{t("seven.afterBody")}</p>
            <p className="text-body text-on-navy-2">{t("seven.afterMore")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-on-navy-border pt-6">
          <p className="text-caption text-on-navy-3">{t("pilot")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="xl" variant="secondary">
              <a href={mailto}>{t("seven.ctaButton")}</a>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-on-navy-border bg-transparent text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
            >
              <Link href="/constructeurs">{t("nav.back")}</Link>
            </Button>
            <span className="text-label text-brass-light">{t("seven.site")}</span>
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
      {/* The site's foot belongs to the site, not to the deck: printed, it would open an eighth
          page under seven. */}
      <div className="print:hidden">
        <MarketingFooter />
      </div>
    </main>
  );
}

/**
 * The two paths of page 3, drawn as the deck draws them: a rail of four moments, and the ones
 * that are lit. Colour never carries the difference on its own (rule 12) — the four bodies say
 * it in words, and the lit steps of the yard's rail are exactly the ones whose text is bad news.
 */
function Timeline({
  label,
  labelTone,
  steps,
  litClass,
  litText,
}: {
  label: string;
  labelTone: string;
  steps: readonly { title: string; body: string; lit?: boolean }[];
  litClass: string;
  litText: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className={`text-overline uppercase ${labelTone}`}>{label}</p>
      <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <li key={step.title} className="flex min-w-0 flex-col gap-2">
            <span aria-hidden className="flex items-center gap-1">
              <span
                className={`size-2.5 shrink-0 rounded-full ${step.lit ? litClass : "bg-border-strong"}`}
              />
              <span className={`h-px flex-1 ${step.lit ? litClass : "bg-border"}`} />
            </span>
            <p className="text-label text-foreground">{step.title}</p>
            <p className={`text-caption ${step.lit ? litText : "text-ink-2"}`}>{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Page 5's carnet: the same three lines as the home page's preview, drawn on paper. */
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
          <p className="text-label text-foreground">{t("brochure.five.boat")}</p>
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
      <figcaption className="text-caption text-ink-3">{t("brochure.five.caption")}</figcaption>
    </figure>
  );
}
