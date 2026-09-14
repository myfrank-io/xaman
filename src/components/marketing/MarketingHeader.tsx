import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { XamanLogotype } from "@/components/brand/XamanLogotype";
import { Button } from "@/components/ui/button";

/**
 * The navigation of the public site, shared by the two audiences (D126).
 *
 * Two pages, two readers: an owner who will open a carnet tonight, and a shipyard that sells
 * service with its hulls. The header is the only place where each is told the other exists —
 * `current` drops the link to the page one is already on rather than leaving a link to nowhere.
 */
export async function MarketingHeader({ current }: { current: "home" | "builders" }) {
  const t = await getTranslations("marketing.nav");

  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 safe-pt-6 lg:px-8">
      <Link
        href="/"
        aria-label={t("home")}
        className="inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-brass-light/60"
      >
        <XamanLogotype className="h-8" />
      </Link>
      {/* Three controls at 320 px are 395 px of buttons: the row wraps rather than running off
          the screen, and the audience switch lands on its own line. */}
      <nav className="flex flex-wrap items-center justify-end gap-2">
        <Button
          asChild
          variant="ghost"
          className="text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
        >
          <Link href={current === "home" ? "/constructeurs" : "/"}>
            {current === "home" ? t("builders") : t("owners")}
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="text-on-navy hover:bg-on-navy-surface hover:text-on-navy"
        >
          <Link href="/login">{t("login")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/signup">{t("signup")}</Link>
        </Button>
      </nav>
    </header>
  );
}
