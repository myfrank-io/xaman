import type { Metadata } from "next";
import Link from "next/link";
import {
  EyeOffIcon,
  HandshakeIcon,
  PackageCheckIcon,
  PhoneOffIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  ShipWheelIcon,
  TrendingDownIcon,
  UsersIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FleetPreview } from "@/components/marketing/FleetPreview";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.builders.meta");
  return { title: { absolute: t("title") }, description: t("description") };
}

/**
 * The public page for shipyards and builders (D125, D126).
 *
 * The second audience, and the one the business runs on: a builder who sells a service option
 * with the hull, the way a car maker sells its maintenance contract. It says three things the
 * owner's page cannot: what the handshake costs them today, what they get, and — the clause
 * that makes the whole thing sellable — what they will never see.
 *
 * It is deliberately honest about its own state: the owner's carnet ships, the builder floor
 * (fleet, warranties, bulletins, the carnet delivered with the boat) is a pilot looking for two
 * or three yards. Promising it as shipped would burn the only prospects worth having.
 */
export default async function BuildersPage() {
  const t = await getTranslations("marketing.builders");

  const losses = [
    { key: "link", Icon: HandshakeIcon },
    { key: "revenue", Icon: TrendingDownIcon },
    { key: "warranty", Icon: PhoneOffIcon },
    { key: "blind", Icon: EyeOffIcon },
  ] as const;

  const gains = [
    { key: "delivery", Icon: PackageCheckIcon },
    { key: "plan", Icon: ScrollTextIcon },
    { key: "fleet", Icon: ShipWheelIcon },
    { key: "claims", Icon: ShieldCheckIcon },
    { key: "stats", Icon: UsersIcon },
    { key: "offer", Icon: ReceiptTextIcon },
  ] as const;

  const steps = ["one", "two", "three"] as const;
  const rules = ["one", "two", "three"] as const;

  const mailto = `mailto:${t("cta.email")}?subject=${encodeURIComponent(t("cta.subject"))}`;

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="bg-header-gradient text-on-navy">
        <MarketingHeader current="builders" />

        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pt-12 pb-16 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:pt-16 lg:pb-24">
          <div className="flex min-w-0 flex-col gap-6">
            <p className="text-overline text-brass-light uppercase">{t("hero.eyebrow")}</p>
            <h1 className="max-w-2xl text-[2rem] leading-[1.15] font-semibold tracking-tight sm:text-[2.5rem] lg:text-[3rem]">
              {t("hero.title")}
            </h1>
            <p className="max-w-xl text-body-lg text-on-navy-2">{t("hero.subtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="xl" variant="secondary">
                <a href={mailto}>{t("hero.primary")}</a>
              </Button>
              {/* The deck, read on the site rather than sent as an attachment (E19-10). */}
              <Button
                asChild
                size="xl"
                variant="outline"
                className="border-on-navy-border bg-transparent text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
              >
                <Link href="/constructeurs/brochure">{t("hero.brochure")}</Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="outline"
                className="border-on-navy-border bg-transparent text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
              >
                <Link href="/">{t("hero.secondary")}</Link>
              </Button>
            </div>
            <p className="text-caption text-on-navy-3">{t("hero.note")}</p>
          </div>
          <FleetPreview />
        </section>
      </div>

      {/* What the handshake costs them. Named before anything is offered: a yard that does not
          recognise itself in these four lines is not a prospect. */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
        <h2 className="text-h1">{t("losses.title")}</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {losses.map(({ key, Icon }) => (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <span className="flex size-11 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-h2">{t(`losses.${key}.title`)}</h3>
              <p className="text-body text-ink-2">{t(`losses.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-border bg-surface-2">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
          <h2 className="text-h1">{t("gains.title")}</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gains.map(({ key, Icon }) => (
              <li
                key={key}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <span className="flex size-11 items-center justify-center rounded-lg bg-navy text-on-navy">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="text-h2">{t(`gains.${key}.title`)}</h3>
                <p className="text-body text-ink-2">{t(`gains.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
        <h2 className="text-h1">{t("sale.title")}</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step} className="flex flex-col gap-2">
              <span className="flex size-11 items-center justify-center rounded-full border border-border-strong bg-surface text-h2 text-foreground">
                {index + 1}
              </span>
              <h3 className="text-h2">{t(`sale.${step}.title`)}</h3>
              <p className="text-body text-ink-2">{t(`sale.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The clause that makes the option sellable (D121). It sits on the builder's page, not
          only the owner's, because it is the builder who has to be able to say it out loud. */}
      <section className="border-y border-border bg-surface-2">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
          <h2 className="text-h1">{t("privacy.title")}</h2>
          <p className="mt-3 max-w-2xl text-body-lg text-ink-2">{t("privacy.body")}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {rules.map((rule) => (
              <li
                key={rule}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <h3 className="text-h2">{t(`privacy.${rule}.title`)}</h3>
                <p className="text-body text-ink-2">{t(`privacy.${rule}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-navy-deep text-on-navy">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-16 text-center lg:px-8 lg:py-20">
          <p className="text-overline text-brass-light uppercase">{t("cta.eyebrow")}</p>
          <h2 className="text-h1 text-balance">{t("cta.title")}</h2>
          <p className="max-w-xl text-body-lg text-on-navy-2">{t("cta.body")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="xl" variant="secondary">
              <a href={mailto}>{t("cta.button")}</a>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-on-navy-border bg-transparent text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
            >
              <Link href="/constructeurs/brochure">{t("cta.brochure")}</Link>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-on-navy-border bg-transparent text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
            >
              <Link href="/">{t("cta.secondary")}</Link>
            </Button>
          </div>
          <p className="text-caption text-on-navy-3">{t("cta.email")}</p>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
