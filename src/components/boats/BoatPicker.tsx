import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PlusIcon, SailboatIcon } from "lucide-react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { BoatsShell } from "@/components/boats/BoatsShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { NEW_BOAT_PATH } from "@/lib/queries/boat-routes";

export type PickableBoat = {
  id: string;
  name: string;
  builder: string | null;
  model: string | null;
};

/**
 * The screen between signing in and a boat (E1-3, E10-2) — for anyone who keeps more than one.
 *
 * It is no longer the waiting room it used to be: someone with no boat is sent straight to
 * « Ajouter mon bateau » by the page around it (D63), so the empty state here is only reached
 * from the gallery. The row that opens a second carnet sits at the end of the list, where the
 * eye already is after reading it, rather than as a button competing with the boats.
 *
 * It lives in a component rather than in the page so `/dev/ui/boats` shows this exact markup:
 * the page around it redirects when there is a single boat, which is the common case, so the
 * screen is otherwise almost impossible to open and was never once looked at on a phone.
 */
export async function BoatPicker({ boats }: { boats: PickableBoat[] }) {
  const t = await getTranslations("boats");

  return (
    <BoatsShell title={t("title")}>
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
          <li className="min-w-0">
            <Link
              href={NEW_BOAT_PATH as Route}
              className="flex min-h-20 items-center gap-3 rounded-xl border border-border-strong tap-feedback bg-surface-2 p-4 text-ink-2 transition-colors sm:gap-4"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
                <PlusIcon className="size-6" />
              </span>
              <span className="min-w-0 truncate text-label font-medium">{t("new.add")}</span>
            </Link>
          </li>
        </ul>
      ) : (
        <EmptyState
          icon={<SailboatIcon />}
          title={t("none.title")}
          description={t("none.description")}
          action={
            <Button asChild size="lg">
              <Link href={NEW_BOAT_PATH as Route}>{t("new.add")}</Link>
            </Button>
          }
        />
      )}
      <div className="mt-auto flex justify-end pt-4">
        <SignOutButton />
      </div>
    </BoatsShell>
  );
}
