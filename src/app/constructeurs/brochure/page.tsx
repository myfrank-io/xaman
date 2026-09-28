import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClockIcon,
  CarIcon,
  HandshakeIcon,
  HistoryIcon,
  SailboatIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { XamanLogotype } from "@/components/brand/XamanLogotype";
import { BrochureRail } from "@/components/marketing/brochure/BrochureRail";
import { BrochureSlide } from "@/components/marketing/brochure/BrochureSlide";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

const TOTAL = 6;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.brochure.meta");
  return { title: { absolute: t("title") }, description: t("description") };
}

/**
 * The builders' presentation, read on the site rather than sent as a PDF (E19-10, E19-12, D155).
 *
 * Six pages that sell a call: what Xaman is and who builds it, MyFrank's own numbers, the car
 * trade beside the marine one, the tool itself in two pages (the owner's side, then the yard's),
 * and a thirty-minute call with a pilot at the end of it. The seven pages it replaced argued the
 * yard's business back to it and read as machine-written; these say what we have and what we
 * want, and nothing about the reader they have not been told.
 *
 * The tool pages show what runs today — due dates, the journal, « Confier au chantier » — and
 * say so when they do not: the builder's warranty is carried by the pilot (E19-2, E19-3), and
 * its card is drawn as an example rather than read from a boat.
 *
 * MyFrank's figures (300+ companies, 4,9/5) are the ones myfrank.io publishes; the 400 points of
 * sale are the team's own count. Keep the three in step with the site before each send.
 *
 * There is no way back to `/constructeurs` from here: the brochure is sent on its own, as a
 * link or a PDF, to someone who has not seen the offer page. It ends on two people to write to.
 *
 * Re-drawn with the tokens of `globals.css` rather than embedded as a PDF: a flattened raster has
 * no selectable text, nothing a screen reader can read, and is a second copy of a design that
 * already lives in the app.
 */
export default async function BrochurePage() {
  const t = await getTranslations("marketing.brochure");
  const tNav = await getTranslations("marketing.nav");
  const source = t("footer");

  const pages = Array.from({ length: TOTAL }, (_, i) => i + 1);
  const goTo = pages.map((number) => t("nav.goTo", { number }));
  const position = pages.map((number) => t("nav.position", { number, total: TOTAL }));

  // Two people to write to, by name, rather than the builders' letterbox (E19-9): that one does
  // not exist yet, and a brochure sent to a yard cannot end on an address that bounces.
  const subject = encodeURIComponent(t("six.mailSubject"));
  const contacts = [t("six.contactOne"), t("six.contactTwo")];

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
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              side: "car",
              Icon: CarIcon,
              box: "border border-border bg-surface shadow-sm",
            },
            { side: "boat", Icon: SailboatIcon, box: "bg-surface-2" },
          ].map(({ side, Icon, box }) => (
            <article key={side} className={`flex flex-col gap-4 rounded-xl p-5 lg:p-6 ${box}`}>
              <h3 className="flex items-center gap-2 text-h2">
                <Icon className="size-5 shrink-0 text-ink-2" aria-hidden />
                {t(`three.${side}Label` as "three.carLabel")}
              </h3>
              <dl className="flex flex-col divide-y divide-border">
                {(["Sale", "Care", "Resale"] as const).map((moment) => (
                  <div key={moment} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <dt className="text-overline text-ink-3 uppercase">
                      {t(`three.moment${moment}` as "three.momentSale")}
                    </dt>
                    <dd className="m-0 text-body text-foreground">
                      {t(`three.${side}${moment}` as "three.carSale")}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 4 */}
      <BrochureSlide
        index={4}
        total={TOTAL}
        tone="paper"
        eyebrow={t("four.eyebrow")}
        title={t("four.title")}
        source={source}
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <Feature
            Icon={CalendarClockIcon}
            title={t("four.preventiveTitle")}
            body={t("four.preventiveBody")}
          >
            <CarnetCard />
          </Feature>
          <Feature Icon={HistoryIcon} title={t("four.historyTitle")} body={t("four.historyBody")}>
            <Panel label={t("four.journalLabel")}>
              {(["One", "Two", "Three"] as const).map((n) => (
                <li key={n} className="px-4 py-3">
                  <p className="text-label text-foreground">
                    {t(`four.journal${n}` as "four.journalOne")}
                  </p>
                  <p className="mt-0.5 text-caption text-ink-2">
                    {t(`four.journal${n}Meta` as "four.journalOneMeta")}
                  </p>
                </li>
              ))}
            </Panel>
          </Feature>
        </div>
        <p className="text-caption text-ink-3">{t("four.caption")}</p>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 5 */}
      <BrochureSlide
        index={5}
        total={TOTAL}
        tone="paper"
        eyebrow={t("five.eyebrow")}
        title={t("five.title")}
        source={source}
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <Feature Icon={HandshakeIcon} title={t("five.supportTitle")} body={t("five.supportBody")}>
            <Panel label={t("five.handoffLabel")}>
              {(["Boat", "Item", "State", "Last"] as const).map((row) => (
                <Fact
                  key={row}
                  label={t(`five.handoff${row}Label` as "five.handoffBoatLabel")}
                  value={t(`five.handoff${row}Value` as "five.handoffBoatValue")}
                />
              ))}
            </Panel>
          </Feature>
          <Feature
            Icon={ShieldCheckIcon}
            title={t("five.warrantyTitle")}
            body={t("five.warrantyBody")}
            tag={t("five.warrantyTag")}
          >
            <Panel label={t("five.warrantyLabel")} badge={t("five.warrantyBadge")}>
              {(["Cover", "Claim"] as const).map((row) => (
                <Fact
                  key={row}
                  label={t(`five.warranty${row}Label` as "five.warrantyCoverLabel")}
                  value={t(`five.warranty${row}Value` as "five.warrantyCoverValue")}
                />
              ))}
            </Panel>
          </Feature>
        </div>
      </BrochureSlide>

      {/* ------------------------------------------------------------- 6 */}
      <BrochureSlide
        index={6}
        total={TOTAL}
        tone="navy"
        eyebrow={t("six.eyebrow")}
        title={t("six.title")}
        source={source}
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <p className="text-body-lg text-on-navy-2">{t("six.lead")}</p>
          <div className="flex flex-col gap-3">
            <p className="text-overline text-brass-light uppercase">{t("six.askLabel")}</p>
            <ol className="flex flex-col divide-y divide-on-navy-border border-y border-on-navy-border">
              {(["One", "Two", "Three"] as const).map((n, i) => (
                <li key={n} className="flex items-baseline gap-4 py-3">
                  <span aria-hidden className="w-5 shrink-0 num text-label text-brass-light">
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-body text-on-navy">
                    {t(`six.ask${n}` as "six.askOne")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-on-navy-border pt-6">
          <div className="flex flex-col gap-1">
            <p className="text-overline text-brass-light uppercase">{t("six.contactLabel")}</p>
            <ul className="flex flex-wrap items-center gap-x-6">
              {contacts.map((email) => (
                <li key={email}>
                  <a
                    href={`mailto:${email}?subject=${subject}`}
                    className="inline-flex min-h-11 items-center text-body-lg font-medium text-on-navy underline decoration-on-navy-border underline-offset-4 outline-none hover:decoration-on-navy focus-visible:ring-[3px] focus-visible:ring-brass-light/60"
                  >
                    {email}
                  </a>
                </li>
              ))}
              <li className="text-label text-brass-light">{t("six.site")}</li>
            </ul>
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

/**
 * One element of the tool, on pages 4 and 5: what it does in two lines, then what it looks like.
 * `tag` marks the elements the pilot builds rather than the app already runs.
 */
function Feature({
  Icon,
  title,
  body,
  tag,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  tag?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-h2">
          <Icon className="size-5 shrink-0 text-ink-2" aria-hidden />
          {title}
          {tag ? (
            <span className="rounded-full border border-border-strong bg-surface px-2.5 py-0.5 text-caption font-medium text-ink-2">
              {tag}
            </span>
          ) : null}
        </h3>
        <p className="mt-1 text-body text-ink-2">{body}</p>
      </div>
      {children}
    </div>
  );
}

/** A card drawn the way the app draws its lists: a grey header, then one row per line. */
function Panel({ label, badge, children }: { label: string; badge?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-3">
        <p className="text-label text-foreground">{label}</p>
        {badge ? (
          <span className="shrink-0 rounded-full border border-state-ok-border bg-state-ok-tint px-2.5 py-1 text-caption font-medium text-state-ok-fg">
            {badge}
          </span>
        ) : null}
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <span className="shrink-0 text-caption text-ink-3">{label}</span>
      <span className="min-w-0 text-right text-label text-foreground">{value}</span>
    </li>
  );
}

/** Page 4's due dates: the same three lines as the home page's preview, drawn on paper. */
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
    <Panel label={t("brochure.four.boat")}>
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
    </Panel>
  );
}
