import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** The foot of both public pages: what the product is, and the door to the other audience. */
export async function MarketingFooter() {
  const ta = await getTranslations("app");
  const t = await getTranslations("marketing");

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-end sm:justify-between lg:px-8">
        <div className="flex flex-col gap-1">
          <p className="text-label text-foreground">{ta("name")}</p>
          <p className="text-caption text-ink-2">{t("footer.tagline")}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link
            href="/constructeurs"
            className="inline-flex min-h-11 items-center text-label text-ink-2 underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("nav.builders")}
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center text-label text-ink-2 underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center text-label text-ink-2 underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("nav.signup")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
