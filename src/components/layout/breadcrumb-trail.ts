import { BOAT_ROUTES } from "@/lib/queries/boat-routes";
import type { NavKey } from "@/components/layout/nav";

/** A path segment that is an id carries no meaning for a reader: it becomes « Fiche ». */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Segments that are a step of a flow rather than a section of the app. */
export const CRUMB_STEPS = [
  "new",
  "edit",
  "review",
  "setup",
  "import",
  "engines",
  "equipment",
  "purchases",
  "parts",
  "report",
  "profile",
] as const;
export type CrumbStep = (typeof CRUMB_STEPS)[number];

export type Crumb = {
  /** Translation key: a nav key for the section, `crumbs.<step>` for a step. */
  key: NavKey | `crumbs.${CrumbStep}` | "crumbs.record";
  /** Absent on the last crumb: you do not link to where you already are. */
  href?: string;
};

/**
 * Turns the URL into a trail (E12 UX). Derived from the path rather than declared page by
 * page: every screen gets one, and a new route inherits it for free. A tab root gets nothing —
 * « Journal » alone above the Journal screen is noise.
 */
export function buildTrail(pathname: string, boatId: string): Crumb[] {
  const prefix = `/boats/${boatId}`;
  if (!pathname.startsWith(prefix)) return [];
  const segments = pathname.slice(prefix.length).split("/").filter(Boolean);
  if (segments.length <= 1) return [];

  const section = (Object.keys(BOAT_ROUTES) as NavKey[]).find(
    (key) => BOAT_ROUTES[key] === segments[0],
  );
  if (!section) return [];

  const crumbs: Crumb[] = [{ key: section, href: `${prefix}/${segments[0]}` }];
  segments.slice(1).forEach((segment, index) => {
    const last = index === segments.length - 2;
    const href = last ? undefined : `${prefix}/${segments.slice(0, index + 2).join("/")}`;
    if (ID.test(segment)) crumbs.push({ key: "crumbs.record", href });
    else if ((CRUMB_STEPS as readonly string[]).includes(segment)) {
      crumbs.push({ key: `crumbs.${segment as CrumbStep}`, href });
    }
  });
  // Nothing but the section: the screen is a tab root under another name.
  return crumbs.length > 1 ? crumbs : [];
}
