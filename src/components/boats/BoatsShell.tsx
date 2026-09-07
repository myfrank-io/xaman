import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeftIcon } from "lucide-react";

import { XamanLogotype } from "@/components/brand/XamanLogotype";

/**
 * The frame of the two screens that live between signing in and a boat: the picker (several
 * boats) and « Ajouter mon bateau » (none yet). Neither can use `AppShell`, which needs a boat
 * to build its navigation from, and both need the navy header so the app does not start on a
 * bare white page.
 */
export async function BoatsShell({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  /**
   * The way out, for someone who is here by choice rather than because they have no boat.
   * `AppShell` is not on these screens, so without it the only thing left on « Ajouter un
   * bateau » is « Se déconnecter » — signalled at use: on an iPad in standalone there is no URL
   * bar and no back gesture to fall back on. Omitted when there is genuinely nowhere to return
   * to, which is exactly the account with no boat yet.
   */
  back?: { href: string; label: string };
  children: ReactNode;
}) {
  const ta = await getTranslations("app");

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-header-gradient px-4 safe-pt-8 pb-10 text-on-navy brass-rule sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {back ? (
            <Link
              href={back.href as Route}
              className="mb-3 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg tap-feedback px-2 text-label font-medium text-on-navy-2 focus-visible:ring-[3px] focus-visible:ring-on-navy/50 focus-visible:outline-none"
            >
              <ChevronLeftIcon className="size-5" aria-hidden />
              {back.label}
            </Link>
          ) : null}
          <p className="text-overline text-brass-light uppercase">{ta("eyebrow")}</p>
          <XamanLogotype className="mt-3 h-9" />
          <h1 className="mt-5 text-h1">{title}</h1>
          {subtitle ? <p className="mt-2 text-body text-on-navy-2">{subtitle}</p> : null}
        </div>
      </header>
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        {children}
      </section>
    </main>
  );
}
