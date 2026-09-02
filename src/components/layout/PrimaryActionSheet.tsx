"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  AnchorIcon,
  ChevronRightIcon,
  EuroIcon,
  FlameIcon,
  GaugeIcon,
  NotebookPenIcon,
  PlusIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { BoatRole } from "@/lib/permissions";
import {
  hourReadingPath,
  newChecklistItemPath,
  newContactPath,
  newHaulOutPath,
  newLogPath,
  newPurchasePath,
  suppliesPath,
} from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

export type CreateKey = "log" | "hourReading" | "gas" | "purchase" | "haulOut";

/** Dynamic subtitles, computed server-side and passed down as plain strings. */
export type PrimaryActionHints = Partial<Record<CreateKey, string>>;

const ENTRY_ICONS: Record<CreateKey, LucideIcon> = {
  log: NotebookPenIcon,
  hourReading: GaugeIcon,
  gas: FlameIcon,
  purchase: EuroIcon,
  haulOut: AnchorIcon,
};

// Order = frequency of use (ux-flows §1.4).
const ALL_KEYS: CreateKey[] = ["log", "hourReading", "gas", "purchase", "haulOut"];
// A `pro` only records his own work: two entries, the others are absent (not greyed).
const PRO_KEYS: CreateKey[] = ["log", "hourReading"];

function entryHref(key: CreateKey, boatId: string): string {
  switch (key) {
    case "log":
      return newLogPath(boatId);
    case "hourReading":
      return hourReadingPath(boatId);
    case "gas":
      return suppliesPath(boatId, "gas");
    case "purchase":
      return newPurchasePath(boatId);
    case "haulOut":
      return newHaulOutPath(boatId);
  }
}

/**
 * The single creation control of the app (R2). One component, two placements:
 * sidebar footer from `lg`, compact header below. No floating FAB — it covers
 * the last row of every list and duplicates a control that already exists.
 *
 * Behaviour: when the screen has an obvious object the « + » creates it
 * directly; otherwise it opens the choice sheet (ux-flows §1.4).
 */
export function PrimaryActionSheet({
  boatId,
  role,
  hints,
}: {
  boatId: string;
  role: BoatRole;
  hints?: PrimaryActionHints;
}) {
  const t = useTranslations("create");
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  const base = `/boats/${boatId}`;
  // Outside the boat tree (design gallery, previews) the sheet is the default.
  const inBoat = pathname.startsWith(base);
  const segments = inBoat ? pathname.slice(base.length).split("/").filter(Boolean) : [];

  // Screens with no creation of their own: detail pages and read-only screens.
  const hidden =
    inBoat &&
    (["trash", "members", "settings"].includes(segments[0] ?? "") ||
      (segments[0] === "logs" && segments.length > 1) ||
      (segments[0] === "checklist" && segments.length > 2) ||
      (segments[0] === "contacts" && segments.length > 1) ||
      // Haul-out sheet and purchase form: each carries its own creation control.
      (segments[0] === "haul-outs" && segments.length > 1) ||
      (segments[0] === "supplies" && segments.length > 1));

  // Direct target when the screen has one obvious object.
  let directHref: string | null = null;
  if (segments[0] === "logs" && segments.length === 1) directHref = newLogPath(boatId);
  if (segments[0] === "checklist" && segments.length === 2 && segments[1]) {
    directHref = newChecklistItemPath(boatId, segments[1]);
  }
  if (segments[0] === "contacts" && segments.length === 1 && role !== "pro") {
    directHref = newContactPath(boatId);
  }
  // « Dépenses » creates a purchase, « Sorties de l'eau » a haul-out: one obvious object each.
  if (segments[0] === "supplies" && segments.length === 1 && role !== "pro") {
    directHref = newPurchasePath(boatId);
  }
  if (segments[0] === "haul-outs" && segments.length === 1 && role !== "pro") {
    directHref = newHaulOutPath(boatId);
  }

  const keys = role === "pro" ? PRO_KEYS : ALL_KEYS;

  if (hidden) return null;

  if (directHref) {
    return (
      <>
        <Button asChild size="icon" variant="inverse" className="lg:hidden">
          <Link href={directHref as Route} aria-label={tc("add")}>
            <PlusIcon />
          </Link>
        </Button>
        <Button asChild size="xl" className="hidden w-full lg:inline-flex">
          <Link href={directHref as Route}>
            <PlusIcon />
            {tc("add")}
          </Link>
        </Button>
      </>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        variant="inverse"
        aria-label={tc("add")}
        onClick={() => setOpen(true)}
        className="lg:hidden"
      >
        <PlusIcon />
      </Button>
      <Button size="xl" onClick={() => setOpen(true)} className="hidden w-full lg:inline-flex">
        <PlusIcon />
        {tc("add")}
      </Button>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <ul className="flex flex-col border-t border-border">
          {keys.map((key) => {
            const Icon = ENTRY_ICONS[key];
            const hint = hints?.[key];
            return (
              <li key={key}>
                <Link
                  href={entryHref(key, boatId) as Route}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-16 items-center gap-3 border-b border-border tap-feedback px-4 py-2",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  )}
                >
                  <Icon className="size-5 shrink-0 text-ink-2" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium">{t(key)}</span>
                    {hint ? (
                      <span className="block truncate num text-caption text-ink-2">{hint}</span>
                    ) : null}
                  </span>
                  <ChevronRightIcon className="size-5 shrink-0 text-n-400" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
