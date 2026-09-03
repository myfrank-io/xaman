import { describe, expect, it } from "vitest";

import { buildTrail, type Crumb } from "@/components/layout/breadcrumb-trail";
import fr from "@/messages/fr.json";

const BOAT = "0406f409-ac58-4ec4-af7e-ef8e1261ec54";
const LOG = "8c3ba2b4-9b91-46ac-91f7-3f6de5078bae";
const CATEGORY = "1f0a1c2d-3e4f-4a5b-8c9d-0e1f2a3b4c5d";
const ITEM = "2a1b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e";
const ENGINE = "3b2c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6f";
const PART = "4c3d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f";
const PURCHASE = "5d4e6f7a-8b9c-4d0e-9f2a-3b4c5d6e7f80";
const HAUL_OUT = "6e5f7a8b-9c0d-4e1f-8a3b-4c5d6e7f8091";
const CONTACT = "7f6a8b9c-0d1e-4f2a-9b4c-5d6e7f809102";

const at = (path: string, entity?: string) => buildTrail(`/boats/${BOAT}${path}`, BOAT, entity);
const path = (suffix: string) => `/boats/${BOAT}${suffix}`;

/** Resolves the crumb key against `fr.json`: a key with no label fails the test. */
function label(key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      fr.nav as unknown,
    );
  if (typeof value !== "string") throw new Error(`no label in fr.json for nav.${key}`);
  return value;
}

const labels = (trail: Crumb[]) => trail.map((crumb) => label(crumb.key));
/** The crumbs rendered as the current page: the ones without a link. */
const current = (trail: Crumb[]) => trail.filter((crumb) => !crumb.href).map((c) => label(c.key));

/**
 * Every screen served under `/boats/<id>` — one `page.tsx` each. A crumb that links to
 * anything else is a 404 waiting for the person climbing back out.
 */
const SCREENS = new Set([
  "dashboard",
  "logs",
  "logs/new",
  "logs/review",
  "logs/:id",
  "logs/:id/edit",
  "checklist",
  "checklist/setup",
  "checklist/:id",
  "checklist/:id/new",
  "checklist/:id/:id/edit",
  "boat",
  "boat/engines/new",
  "boat/engines/:id",
  "boat/engines/:id/edit",
  "boat/equipment/new",
  "boat/equipment/:id",
  "boat/equipment/:id/edit",
  "contacts",
  "contacts/new",
  "contacts/:id",
  "contacts/:id/edit",
  "haul-outs",
  "haul-outs/new",
  "haul-outs/:id",
  "haul-outs/:id/edit",
  "supplies",
  "boat/parts/new",
  "boat/parts/:id/edit",
  "supplies/purchases/new",
  "supplies/purchases/:id/edit",
  "members",
  "settings",
  "trash",
  "report",
  "import",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `/boats/<id>/supplies?tab=stock` → `supplies`: the screen behind an href. */
function screenOf(href: string): string {
  const [route = ""] = href.split("?");
  return route
    .replace(`/boats/${BOAT}`, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => (UUID.test(segment) ? ":id" : segment))
    .join("/");
}

/** One entry per screen of the app, to check the invariants on all of them at once. */
const ALL_PATHS = [
  "/dashboard",
  "/logs",
  "/logs/new",
  "/logs/review",
  `/logs/${LOG}`,
  `/logs/${LOG}/edit`,
  "/checklist",
  "/checklist/setup",
  `/checklist/${CATEGORY}`,
  `/checklist/${CATEGORY}/new`,
  `/checklist/${CATEGORY}/${ITEM}/edit`,
  "/boat",
  "/boat/engines/new",
  `/boat/engines/${ENGINE}`,
  `/boat/engines/${ENGINE}/edit`,
  "/boat/equipment/new",
  "/contacts",
  "/contacts/new",
  `/contacts/${CONTACT}`,
  `/contacts/${CONTACT}/edit`,
  "/haul-outs",
  "/haul-outs/new",
  `/haul-outs/${HAUL_OUT}`,
  `/haul-outs/${HAUL_OUT}/edit`,
  "/supplies",
  "/boat/parts/new",
  `/boat/parts/${PART}/edit`,
  "/supplies/purchases/new",
  `/supplies/purchases/${PURCHASE}/edit`,
  "/members",
  "/settings",
  "/trash",
  "/report",
  "/import",
];

describe("buildTrail", () => {
  it("gives a section root no trail at all: one crumb is not a trail", () => {
    // « Checklist › » over a heading reading « Checklist », with the Checklist tab lit below,
    // is the same word three times — and on a phone it costs a row of a screen that has few
    // to spare. A trail earns its line only once it has somewhere to go back to.
    expect(at("/logs")).toEqual([]);
    expect(at("/checklist")).toEqual([]);
    expect(at("/boat")).toEqual([]);
    expect(at("/dashboard")).toEqual([]);
  });

  it("appears as soon as there is a way back up", () => {
    // The home of the boat is a tab, one tap away: it never prefixes another section either.
    expect(labels(at("/logs/new"))).toEqual(["Interventions", "Nouveau"]);
    expect(current(at("/logs/new"))).toEqual(["Nouveau"]);
  });

  it("names the section and the step of a creation screen", () => {
    expect(at("/logs/new")).toEqual([{ key: "logs", href: path("/logs") }, { key: "crumbs.new" }]);
    expect(current(at("/logs/new"))).toEqual(["Nouveau"]);
  });

  it("turns an id into « Fiche », current on the record and a link from its edit screen", () => {
    expect(at(`/logs/${LOG}`)).toEqual([
      { key: "logs", href: path("/logs") },
      { key: "crumbs.record" },
    ]);
    expect(labels(at(`/logs/${LOG}`))).toEqual(["Interventions", "Fiche"]);
    expect(current(at(`/logs/${LOG}`))).toEqual(["Fiche"]);

    expect(at(`/logs/${LOG}/edit`)).toEqual([
      { key: "logs", href: path("/logs") },
      { key: "crumbs.record", href: path(`/logs/${LOG}`) },
      { key: "crumbs.edit" },
    ]);
    expect(current(at(`/logs/${LOG}/edit`))).toEqual(["Modifier"]);
  });

  it("opens a « Plus » sheet section with its own crumb, never with the sheet", () => {
    // The sheet is not a screen: naming it would put a link to nowhere in the trail. Their
    // own roots carry no trail either, for the same reason every section root does not.
    expect(at("/supplies")).toEqual([]);
    expect(at("/contacts")).toEqual([]);
    expect(at("/trash")).toEqual([]);
    expect(at(`/contacts/${CONTACT}/edit`)).toEqual([
      { key: "contacts", href: path("/contacts") },
      { key: "crumbs.record", href: path(`/contacts/${CONTACT}`) },
      { key: "crumbs.edit" },
    ]);
    expect(current(at(`/contacts/${CONTACT}/edit`))).toEqual(["Modifier"]);
  });

  it("climbs out of a deep page: section, sub-list, record, step", () => {
    expect(labels(at(`/boat/engines/${ENGINE}/edit`))).toEqual([
      "Bateau",
      "Moteurs",
      "Fiche",
      "Modifier",
    ]);
    // « Moteurs » is a tab of the boat screen, not a route of its own.
    expect(at(`/boat/engines/${ENGINE}/edit`)[1]?.href).toBe(path("/boat?tab=engines"));
    expect(current(at(`/boat/engines/${ENGINE}/edit`))).toEqual(["Modifier"]);
  });

  // D34: the stock left Dépenses for Bateau, and its list is the Équipements tab.
  it("takes the spare parts back to the Équipements tab of the boat", () => {
    expect(at("/boat/parts/new")).toEqual([
      { key: "boat", href: path("/boat") },
      { key: "crumbs.parts", href: path("/boat?tab=equipment") },
      { key: "crumbs.new" },
    ]);
  });

  // D33: Dépenses is one ledger. A purchase has no list and no screen of its own, so nothing
  // stands between the section and the form.
  it("takes a purchase straight back to the ledger", () => {
    expect(labels(at(`/supplies/purchases/${PURCHASE}/edit`))).toEqual(["Dépenses", "Modifier"]);
  });

  it("hangs the haul-outs off the Journal, the tab they are reached from (D9)", () => {
    expect(at("/haul-outs")).toEqual([{ key: "logs", href: path("/logs") }, { key: "haulOuts" }]);
    expect(labels(at(`/haul-outs/${HAUL_OUT}/edit`))).toEqual([
      "Interventions",
      "Sorties de l'eau",
      "Fiche",
      "Modifier",
    ]);
  });

  it("keeps the checklist item out of the trail: only its category has a screen", () => {
    expect(at(`/checklist/${CATEGORY}/${ITEM}/edit`)).toEqual([
      { key: "checklist", href: path("/checklist") },
      { key: "crumbs.record", href: path(`/checklist/${CATEGORY}`) },
      { key: "crumbs.edit" },
    ]);
  });

  it("covers the screens outside the menu and the guided flows", () => {
    // The report opens from the settings; the import from the list in `?entity=`.
    expect(labels(at("/report"))).toEqual(["Paramètres", "Rapport"]);
    // Without one — a hand-typed URL — it has nowhere to go back to, so it carries no trail
    // rather than guessing a list.
    expect(at("/import")).toEqual([]);
    expect(labels(at("/logs/review"))).toEqual(["Interventions", "Reprise du carnet"]);
    expect(labels(at("/checklist/setup"))).toEqual(["Checklist", "Mise en route"]);
  });

  // Dépenses is one ledger (D33): there is no « Achats » list under it any more, so the trail
  // does not invent a crumb between the section and the form.
  it("takes a new purchase straight back to the ledger", () => {
    expect(at("/supplies/purchases/new")).toEqual([
      { key: "supplies", href: `/boats/${BOAT}/supplies` },
      { key: "crumbs.new" },
    ]);
  });

  // The stock moved under Bateau (D34): its trail starts at Bateau, not at Dépenses.
  it("puts the spare parts under the boat", () => {
    expect(at("/boat/parts/new")).toEqual([
      { key: "boat", href: `/boats/${BOAT}/boat` },
      { key: "crumbs.parts", href: `/boats/${BOAT}/boat?tab=equipment` },
      { key: "crumbs.new" },
    ]);
  });

  it("links only to screens the app serves, on every path", () => {
    for (const suffix of ALL_PATHS) {
      for (const crumb of at(suffix)) {
        if (crumb.href)
          expect(SCREENS, `${suffix} → ${crumb.href}`).toContain(screenOf(crumb.href));
      }
    }
  });

  it("marks exactly one crumb as the current page, the last one, and names them all", () => {
    // A section root carries no trail: one crumb repeats the title above it and the tab below
    // it. Every trail that does appear has at least two crumbs, names them all, and marks
    // exactly one — the last — as the page.
    for (const suffix of ALL_PATHS) {
      const trail = at(suffix);
      if (trail.length === 0) continue;
      expect(trail.length, suffix).toBeGreaterThan(1);
      // `labels` throws on a key `fr.json` does not carry: no crumb ships without a word.
      expect(labels(trail).every(Boolean), suffix).toBe(true);
      expect(current(trail), suffix).toHaveLength(1);
      expect(trail.at(-1)?.href, suffix).toBeUndefined();
    }
  });

  it("ignores a path that is not this boat's", () => {
    expect(buildTrail("/boats/other/logs/new", BOAT)).toEqual([]);
    expect(buildTrail("/login", BOAT)).toEqual([]);
    expect(at("")).toEqual([]);
  });
});

/**
 * The import screen is the one screen whose section the path cannot tell: `/import` is the
 * same address for the seven lists, and only `?entity=` says which. Reported at the tiller —
 * « il manque le fil d'Ariane et la catégorie dans laquelle on est dans le menu de gauche ».
 */
describe("an import belongs to the list it is going into", () => {
  it("opens the trail on that list, and names the tab when the list is one", () => {
    expect(labels(at("/import", "logs"))).toEqual(["Interventions", "Importer"]);
    expect(labels(at("/import", "purchases"))).toEqual(["Dépenses", "Importer"]);
    expect(labels(at("/import", "contacts"))).toEqual(["Intervenants", "Importer"]);
    expect(labels(at("/import", "completions"))).toEqual(["Checklist", "Importer"]);
    // The three lists that live in a tab of Bateau name that tab: the way back is the list.
    expect(labels(at("/import", "readings"))).toEqual(["Bateau", "Moteurs", "Importer"]);
    expect(labels(at("/import", "equipment"))).toEqual(["Bateau", "Équipements", "Importer"]);
    expect(labels(at("/import", "parts"))).toEqual(["Bateau", "Stock", "Importer"]);
  });

  it("links every crumb but the last, and to an address that exists", () => {
    const trail = at("/import", "readings");
    expect(trail.map((crumb) => crumb.href)).toEqual([
      path("/boat"),
      path("/boat?tab=engines"),
      undefined,
    ]);
  });

  it("ignores an entity the app does not serve", () => {
    // No list to go back to, so no trail — never a lone « Importer » naming the screen itself.
    expect(at("/import", "n-importe-quoi")).toEqual([]);
  });
});
