import type { Namespace } from "@/i18n/namespaces";

/**
 * Which message groups each surface hands to the client (D109).
 *
 * One rule: **a slice stands on its own.** Nesting `NextIntlClientProvider` replaces the
 * messages rather than merging them, so a section repeats what its own screens read even when
 * the frame around it already carries the same group. The duplication is a kilobyte; the
 * alternative is a screen that throws.
 *
 * These lists are not guesses: `tests/unit/i18n-slices.test.ts` walks the import graph from each
 * route's entry files, crosses the client boundary and fails when a slice no longer covers what
 * the screens under it ask for. Adding a `useTranslations("…")` to a component is enough to make
 * that test name the slice to widen.
 */

/** The root layout: the toaster and the install capture read nothing. */
export const ROOT: readonly Namespace[] = [];

/** Sign in, sign up, the password screens and the public invitation page. */
export const AUTH: readonly Namespace[] = ["auth", "errors", "invite"];

/** Opening a carnet, step 1 — the boat's identity, before any carnet exists. */
export const NEW_BOAT: readonly Namespace[] = [
  "boatType",
  "boats",
  "enginePropulsion",
  "engines",
  "errors",
  "navigationZone",
  "validation",
];

/** Opening a carnet, steps 2 and 3 — the existing logbook, then the plan and the counters. */
export const ONBOARDING: readonly Namespace[] = [
  "attachments",
  "boats",
  "common",
  "contacts",
  "errors",
  "import",
];

/** The account screen, outside any boat. */
export const PROFILE: readonly Namespace[] = ["auth", "common", "errors", "profile"];

/**
 * The frame around every boat screen: tabs, sidebar, « Plus » sheet, account menu, the creation
 * control and the offline banner. It wraps the section layouts, so it is serialised on every
 * boat page — which is why it holds the frame's vocabulary and nothing else.
 */
export const BOAT_SHELL: readonly Namespace[] = [
  "app",
  "common",
  "create",
  "install",
  "nav",
  "offline",
  "roles",
];

/**
 * One slice per section of the boat tree, declared by the section's own `layout.tsx`. A section
 * is the unit here rather than the page: thirteen layouts instead of forty-one wrappers, for a
 * payload within a few kilobytes of what per-page slicing would give.
 */
export const BOAT_SECTIONS = {
  boat: [
    "boat",
    "boatType",
    "boats",
    "checklistState",
    "common",
    "contacts",
    "create",
    "enginePosition",
    "enginePropulsion",
    "engines",
    "equipment",
    "errors",
    "haulOuts",
    "import",
    "logStatus",
    "navigationZone",
    "offline",
    "parts",
    "restock",
    "supplies",
    "units",
    "validation",
  ],
  checklist: [
    "checklist",
    "checklistState",
    "common",
    "errors",
    "import",
    "offline",
    "parts",
    "restock",
    "units",
    "validation",
  ],
  contacts: [
    "common",
    "contacts",
    "errors",
    "haulOuts",
    "offline",
    "parts",
    "supplies",
    "validation",
  ],
  dashboard: [
    "checklist",
    "checklistState",
    "common",
    "dashboard",
    "engines",
    "errors",
    "install",
    "logStatus",
    "logs",
    "offline",
    "units",
    "validation",
  ],
  haulOuts: [
    "common",
    "contacts",
    "errors",
    "haulOuts",
    "offline",
    "parts",
    "supplies",
    "validation",
  ],
  import: ["common", "contacts", "errors", "import"],
  inbox: ["attachments", "common", "contacts", "errors", "inbox", "purchaseKind", "validation"],
  logs: [
    "attachments",
    "checklistState",
    "common",
    "contacts",
    "errors",
    "logStatus",
    "logs",
    "offline",
    "review",
    "units",
    "validation",
  ],
  members: ["auth", "common", "errors", "invite", "members"],
  report: ["report"],
  settings: ["categories", "common", "errors", "settings", "validation"],
  supplies: [
    "attachments",
    "common",
    "contacts",
    "errors",
    "haulOuts",
    "logStatus",
    "logs",
    "offline",
    "parts",
    "purchaseKind",
    "supplies",
    "validation",
  ],
  trash: ["common", "errors", "trash"],
} satisfies Record<string, readonly Namespace[]>;

export type BoatSection = keyof typeof BOAT_SECTIONS;
