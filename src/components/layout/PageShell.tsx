import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The container of a screen that lives OUTSIDE `AppShell` — no boat, therefore no navigation to
 * build, but the same gutters and the same safe areas as everything else.
 *
 * It exists because « Mon compte » hand-rolled its own `<main>` with `px-6 py-8` and no inset at
 * all: in standalone on the iPad its « Retour » button sat under the status bar, and its gutters
 * were 24 px where every other screen has 16 px on a phone. `safe-pt-8` / `safe-pb-8` ADD the
 * inset to the design's own padding rather than replacing it (see globals.css).
 */
export function PageShell({
  width = "narrow",
  className,
  children,
}: {
  /** `narrow` = one column of reading width (a form, an account); `wide` = the app's own width. */
  width?: "narrow" | "wide";
  className?: string;
  children: ReactNode;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col gap-8 px-4 safe-pt-8 safe-pb-8 sm:px-6 lg:px-8",
        width === "narrow" ? "max-w-2xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </main>
  );
}
