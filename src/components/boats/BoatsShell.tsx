import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

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
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const ta = await getTranslations("app");

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-header-gradient px-4 safe-pt-8 pb-10 text-on-navy brass-rule sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
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
