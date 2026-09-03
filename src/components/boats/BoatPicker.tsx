import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SailboatIcon } from "lucide-react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { XamanLogotype } from "@/components/brand/XamanLogotype";
import { EmptyState } from "@/components/common/EmptyState";

export type PickableBoat = {
  id: string;
  name: string;
  builder: string | null;
  model: string | null;
};

/**
 * The screen between signing in and a boat (E1-3, E10-2) — for anyone who keeps more than one,
 * and the waiting room for someone invited who has not been added yet.
 *
 * It lives in a component rather than in the page so `/dev/ui/boats` shows this exact markup:
 * the page around it redirects when there is a single boat, which is the common case, so the
 * screen is otherwise almost impossible to open and was never once looked at on a phone.
 */
export async function BoatPicker({ boats }: { boats: PickableBoat[] }) {
  const t = await getTranslations("boats");
  const ta = await getTranslations("app");

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-header-gradient px-4 safe-pt-8 pb-10 text-on-navy sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-overline text-brass-light uppercase">{ta("eyebrow")}</p>
          <XamanLogotype className="mt-3 h-9" />
          <h1 className="mt-5 text-h1">{t("title")}</h1>
        </div>
      </header>
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
        {boats.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {boats.map((boat) => (
              // A grid item defaults to `min-width: auto`, so without this the track grows to
              // the longest yard name and the card runs off the screen.
              <li key={boat.id} className="min-w-0">
                <Link
                  href={`/boats/${boat.id}/dashboard` as Route}
                  className="flex min-h-20 items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent sm:gap-4"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-header-gradient text-white">
                    <SailboatIcon className="size-6" />
                  </span>
                  {/* `flex` matters: `min-w-0` does nothing on an inline box, so the two
                      truncating lines below sized themselves to their text and pushed the card
                      129 px past a 320 px screen — invisibly, since the page clips overflow. */}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-lg font-semibold">{boat.name}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[boat.builder, boat.model].filter(Boolean).join(" ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<SailboatIcon />}
            title={t("none.title")}
            description={t("none.description")}
          />
        )}
        <div className="mt-auto flex justify-end pt-4">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
