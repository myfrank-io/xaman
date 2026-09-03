"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  AnchorIcon,
  ChevronRightIcon,
  ContactIcon,
  EuroIcon,
  FlameIcon,
  GaugeIcon,
  ListChecksIcon,
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

export type CreateKey = "hourReading" | "gas" | "purchase" | "haulOut";

/** Dynamic subtitles, computed server-side and passed down as plain strings. */
export type PrimaryActionHints = Partial<Record<CreateKey, string>>;

const ENTRY_ICONS: Record<CreateKey, LucideIcon> = {
  hourReading: GaugeIcon,
  gas: FlameIcon,
  purchase: EuroIcon,
  haulOut: AnchorIcon,
};

/** Fixed subtitles; the dynamic ones (last reading, last bottle) arrive in `hints`. */
type HintKey = "purchaseHint" | "haulOutHint";

const HINT_KEYS: Partial<Record<CreateKey, HintKey>> = {
  purchase: "purchaseHint",
  haulOut: "haulOutHint",
};

// The "other" acts, ordered by frequency of use (ux-flows §1.4). The intervention is the dominant
// act and already has its own named button above the sheet, so it is NOT listed here — a second
// path to it would break "one path per action" (D19, AUDIT §7.2.1).
const OTHER_KEYS: CreateKey[] = ["hourReading", "gas", "purchase", "haulOut"];
// A `pro` only records his own work: the intervention (its button) and an hour reading.
const PRO_KEYS: CreateKey[] = ["hourReading"];

function entryHref(key: CreateKey, boatId: string): string {
  switch (key) {
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

/** The one object a screen obviously creates (D19); null when the screen is ambiguous. */
type DirectKey = "newChecklistItem" | "newContact" | "newPurchase" | "newHaulOut";
type Direct = { href: string; labelKey: DirectKey; icon: LucideIcon };

function directTarget(segments: string[], boatId: string, role: BoatRole): Direct | null {
  const [section, second] = segments;
  if (section === "checklist" && segments.length === 2 && second) {
    return {
      href: newChecklistItemPath(boatId, second),
      labelKey: "newChecklistItem",
      icon: ListChecksIcon,
    };
  }
  if (role === "pro") return null;
  if (section === "contacts" && segments.length === 1) {
    return { href: newContactPath(boatId), labelKey: "newContact", icon: ContactIcon };
  }
  // « Dépenses » creates an expense line, « Sorties de l'eau » a haul-out: one object each.
  if (section === "supplies" && segments.length === 1) {
    return { href: newPurchasePath(boatId), labelKey: "newPurchase", icon: EuroIcon };
  }
  if (section === "haul-outs" && segments.length === 1) {
    return { href: newHaulOutPath(boatId), labelKey: "newHaulOut", icon: AnchorIcon };
  }
  return null;
}

/**
 * The single creation control of the app (R2, D19). One component, two placements: sidebar
 * footer from `lg`, compact header below. No floating FAB — it covers the last row of every
 * list and duplicates a control that already exists.
 *
 * Two shapes, never both: when the screen has an obvious object the control creates it and
 * says its name; otherwise the control is named after the dominant act — « Noter une
 * intervention », one tap to the form — with a quieter « Noter autre chose » under it for the
 * four other acts (D35). « Ajouter » on its own never appears again: it never said what.
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
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  const base = `/boats/${boatId}`;
  // Outside the boat tree (design gallery, previews) the ambiguous shape is the default.
  const inBoat = pathname.startsWith(base);
  const segments = inBoat ? pathname.slice(base.length).split("/").filter(Boolean) : [];

  // Screens with no creation of their own: detail pages and read-only screens.
  const hidden =
    inBoat &&
    (["trash", "members", "settings"].includes(segments[0] ?? "") ||
      // The journal carries « Noter une intervention » in its own header (D35): the frame
      // steps aside so the screen keeps exactly one way in.
      segments[0] === "logs" ||
      (segments[0] === "checklist" && segments.length > 2) ||
      (segments[0] === "contacts" && segments.length > 1) ||
      // Haul-out sheet and purchase form: each carries its own creation control.
      (segments[0] === "haul-outs" && segments.length > 1) ||
      (segments[0] === "supplies" && segments.length > 1));

  const direct = inBoat ? directTarget(segments, boatId, role) : null;
  const keys = role === "pro" ? PRO_KEYS : OTHER_KEYS;

  if (hidden) return null;

  if (direct) {
    const Icon = direct.icon;
    const label = t(direct.labelKey);
    return (
      <>
        <Button asChild size="icon" variant="inverse" className="lg:hidden">
          <Link href={direct.href as Route} aria-label={label}>
            <Icon />
          </Link>
        </Button>
        {/* No icon on the wide button: the label must never be clipped by its own frame. */}
        <Button asChild size="xl" className="hidden w-full px-4 text-label lg:inline-flex">
          <Link href={direct.href as Route}>{label}</Link>
        </Button>
      </>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Compact header: two 44 px squares — the act, then everything else. */}
      <div className="flex items-center gap-1 lg:hidden">
        <Button asChild size="icon" variant="inverse">
          <Link href={newLogPath(boatId) as Route} aria-label={t("primary")}>
            <NotebookPenIcon />
          </Link>
        </Button>
        <Button size="icon" variant="inverse" aria-label={t("other")} onClick={() => setOpen(true)}>
          <PlusIcon />
        </Button>
      </div>
      {/* Sidebar footer: the act in full, the rest one tap under it. */}
      <div className="hidden w-full flex-col gap-1.5 lg:flex">
        <Button asChild size="xl" className="w-full px-4 text-label">
          <Link href={newLogPath(boatId) as Route}>{t("primary")}</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-ink-2"
          onClick={() => setOpen(true)}
        >
          <PlusIcon className="size-4" />
          {t("other")}
        </Button>
      </div>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
        </SheetHeader>
        <ul className="flex flex-col border-t border-border">
          {keys.map((key) => {
            const Icon = ENTRY_ICONS[key];
            const hintKey = HINT_KEYS[key];
            const hint = hints?.[key] ?? (hintKey ? t(hintKey) : undefined);
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
