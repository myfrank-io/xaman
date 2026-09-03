import type { NavKey } from "@/components/layout/nav";
import {
  BOAT_ROUTES,
  boatPath,
  boatTabPath,
  reportPath,
  stockPath,
} from "@/lib/queries/boat-routes";

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

function isStep(segment: string): segment is CrumbStep {
  return (CRUMB_STEPS as readonly string[]).includes(segment);
}

/** The section a screen belongs to: the entry of the menu the trail starts from. */
type Section = {
  crumb: Crumb;
  /** Set when the section is a menu entry; its sub-lists hang off it. */
  nav?: NavKey;
  /** Menu section whose screen leads here (AUDIT D9): its crumb opens the trail. */
  parent?: NavKey;
};

/**
 * First segment → the section of the menu it belongs to (AUDIT D8: four tabs, a « Plus »
 * sheet, an account menu).
 *
 * The « Plus » sheet is deliberately NOT a crumb of its own: it is a sheet, not a screen, so
 * naming it would put a link to nowhere in the middle of the trail. Its sections (Dépenses,
 * Intervenants, Corbeille) open their own trail instead, exactly like a tab does.
 */
function sectionOf(segment: string, boatId: string): Section | null {
  const nav = (Object.keys(BOAT_ROUTES) as NavKey[]).find((key) => BOAT_ROUTES[key] === segment);
  // « Sorties de l'eau » left the menu (D9): it is the third tab of the Journal, and that tab
  // is the only way in — so the Journal opens its trail.
  if (nav === "haulOuts") {
    return { crumb: { key: nav, href: boatPath(boatId, nav) }, nav, parent: "logs" };
  }
  if (nav) return { crumb: { key: nav, href: boatPath(boatId, nav) }, nav };
  // Two screens live outside the menu. The report opens from « Paramètres »…
  if (segment === "report") {
    return { crumb: { key: "crumbs.report", href: reportPath(boatId) }, parent: "settings" };
  }
  // …the import opens from the list named by `?entity=`, which the path does not carry: it
  // stands alone rather than pointing at one of the three lists at random.
  if (segment === "import") return { crumb: { key: "crumbs.import" } };
  return null;
}

/** A sub-list of a section, and whether a record of that list has a screen of its own. */
type Group = { key: `crumbs.${CrumbStep}`; href: string; record: boolean };

/**
 * Sub-lists that are a TAB of their section root rather than a screen: no route serves
 * `/boat/engines` or `/supplies/parts`, the lists live at `/boat?tab=engines` and
 * `/supplies?tab=stock`. The crumb points at the tab — the only address that exists.
 */
function groupOf(section: NavKey | undefined, segment: string, boatId: string): Group | null {
  if (section === "boat") {
    if (segment === "engines") {
      return { key: "crumbs.engines", href: boatTabPath(boatId, "engines"), record: true };
    }
    if (segment === "equipment") {
      return { key: "crumbs.equipment", href: boatTabPath(boatId, "equipment"), record: true };
    }
  }
  // The spare-parts stock moved under Bateau (D34): it is an inventory of things aboard, not
  // money. Its crumb points at the Équipements tab, the only address that serves the list.
  if (section === "boat" && segment === "parts") {
    return { key: "crumbs.parts", href: stockPath(boatId), record: false };
  }
  // Dépenses is one ledger now (D33): `/supplies/purchases` serves no list of its own, so a
  // « Achats » crumb between « Dépenses » and « Nouveau » would name a screen that is the one
  // already above it. A purchase is only ever created or edited, never shown.
  return null;
}

/**
 * Turns the URL into a trail (E12 UX). Derived from the path rather than declared page by
 * page: every screen gets one, and a new route inherits it for free. The trail starts at the
 * section of the menu the screen belongs to — on a section root that single crumb IS the
 * page, deeper it is the way back to the list.
 *
 * The dashboard is the home of a boat but NOT the root of every trail: it is one of the four
 * tabs, always one tap away in the bar and in the sidebar, so opening every trail with it
 * would repeat a control already on screen and push the crumbs that matter onto a second line
 * on a phone. It gets its own crumb on `/dashboard`, and nothing more — the shortest way out
 * of a deep screen is its section, not the home.
 *
 * A crumb that links, links to a screen that exists: never a bare `/boat/engines`, and no
 * « Fiche » for a record the app only ever edits.
 */
export function buildTrail(pathname: string, boatId: string): Crumb[] {
  const prefix = `/boats/${boatId}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return [];
  const segments = pathname.slice(prefix.length).split("/").filter(Boolean);
  const head = segments[0];
  // `/boats/<id>` serves no screen of its own: nothing to name.
  if (!head) return [];
  const section = sectionOf(head, boatId);
  if (!section) return [];

  const crumbs: Crumb[] = [];
  if (section.parent) crumbs.push({ key: section.parent, href: boatPath(boatId, section.parent) });
  crumbs.push(section.crumb);

  let group: Group | null = null;
  segments.slice(1).forEach((segment, index) => {
    const found = groupOf(section.nav, segment, boatId);
    if (found) {
      group = found;
      crumbs.push({ key: found.key, href: found.href });
      return;
    }
    if (ID.test(segment)) {
      // An id has a screen when it is the record of the section (`/logs/<id>`) or of a group
      // that shows its records; otherwise the crumb is dropped rather than left inert.
      const linkable = group ? group.record : index === 0;
      if (linkable) {
        crumbs.push({
          key: "crumbs.record",
          href: `${prefix}/${segments.slice(0, index + 2).join("/")}`,
        });
      }
      return;
    }
    // Steps (`new`, `edit`, `review`…) are always the end of a flow: they never link.
    if (isStep(segment)) crumbs.push({ key: `crumbs.${segment}` });
  });

  // The last crumb is the page itself: it loses its link and carries `aria-current`.
  return crumbs.map((crumb, index) => (index === crumbs.length - 1 ? { key: crumb.key } : crumb));
}
