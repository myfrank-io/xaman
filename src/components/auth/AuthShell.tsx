import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { XamanLogotype } from "@/components/brand/XamanLogotype";

/**
 * The frame shared by sign-in, sign-up and the two password screens: the navy header carrying
 * the brand, then one column of at most a phone's width. The logotype goes back to the public
 * home page, which is the only way out of these screens for someone who has no account yet.
 */
export async function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const ta = await getTranslations("app");
  const tm = await getTranslations("marketing");

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-header-gradient px-6 safe-pt-8 pb-10 text-on-navy brass-rule">
        <div className="mx-auto w-full max-w-md">
          <p className="text-overline text-brass-light uppercase">{ta("eyebrow")}</p>
          <Link
            href="/"
            aria-label={tm("nav.home")}
            className="mt-3 inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-brass-light/60"
          >
            <XamanLogotype className="h-9" />
          </Link>
          <h1 className="mt-5 text-h1">{title}</h1>
          {subtitle ? <p className="mt-2 text-body text-on-navy-2">{subtitle}</p> : null}
        </div>
      </header>
      <section className="flex flex-1 items-center justify-center px-6 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
