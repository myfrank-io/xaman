import { describe, expect, it } from "vitest";

import { messageNamespaces, namespacesFrom, routeEntries } from "../../scripts/i18n-usage.mjs";
import {
  AUTH,
  BOAT_SECTIONS,
  BOAT_SHELL,
  NEW_BOAT,
  ONBOARDING,
  PROFILE,
  ROOT,
} from "../../src/i18n/slices";

/**
 * The message slices of `src/i18n/slices.ts`, checked against the code that reads them.
 *
 * `NextIntlClientProvider` given no `messages` serialises the whole of `fr.json` — 88 KB — into
 * every page's payload. Slicing it is worth ~50 to 90 %, and it fails in the one direction that
 * hurts: a group left out of a slice does not break the build, it throws `MISSING_MESSAGE` on a
 * screen someone opens offshore, weeks later.
 *
 * So no slice is trusted. Each case walks the import graph from the route's own entry files,
 * crosses the client boundary, collects every namespace the client modules ask for, and fails
 * naming the group to add. Over-collecting is safe here (a wide slice only costs bytes), and the
 * scan deliberately over-collects on a computed `useTranslations`.
 */
const BOAT = "src/app/(app)/boats/[boatId]";
const known = messageNamespaces() as Set<string>;

/** The layouts a route renders inside, whose providers do NOT feed the route's own screens. */
function entriesUnder(directory: string, ...extra: string[]): string[] {
  return [...(routeEntries(directory) as string[]), ...extra];
}

function missing(slice: readonly string[], entries: string[]): string[] {
  const needed = namespacesFrom(entries, { known }) as Set<string>;
  return [...needed].filter((namespace) => !slice.includes(namespace)).sort();
}

describe("tranches de messages", () => {
  it("connaît les espaces de noms du fichier de messages", () => {
    expect(known.size).toBeGreaterThan(30);
    expect(known.has("common")).toBe(true);
  });

  it("couvre la racine", () => {
    expect(missing(ROOT, ["src/app/layout.tsx", "src/app/page.tsx"])).toEqual([]);
  });

  it("couvre les écrans de connexion", () => {
    expect(missing(AUTH, entriesUnder("src/app/(auth)"))).toEqual([]);
  });

  it("couvre l'étape 1 de la mise en route", () => {
    expect(missing(NEW_BOAT, ["src/app/(app)/boats/new/page.tsx"])).toEqual([]);
  });

  it("couvre les étapes 2 et 3 de la mise en route", () => {
    expect(missing(ONBOARDING, ["src/app/(app)/boats/new/[boatId]/page.tsx"])).toEqual([]);
  });

  it("couvre le compte", () => {
    expect(missing(PROFILE, entriesUnder("src/app/(app)/settings"))).toEqual([]);
  });

  it("couvre la liste des bateaux", () => {
    // No provider of its own: it renders under the root slice, so it must need nothing.
    expect(missing(ROOT, ["src/app/(app)/boats/page.tsx"])).toEqual([]);
  });

  it("couvre le cadre du bateau", () => {
    // The layouts above every section, and the skeleton they show while one loads: all of it
    // renders outside the section providers, so the frame's slice has to carry it.
    expect(
      missing(BOAT_SHELL, [
        "src/app/layout.tsx",
        "src/app/(app)/layout.tsx",
        `${BOAT}/layout.tsx`,
        `${BOAT}/loading.tsx`,
      ]),
    ).toEqual([]);
  });

  it.each(Object.keys(BOAT_SECTIONS))("couvre la section %s", (section) => {
    const directory = section === "haulOuts" ? "haul-outs" : section;
    const slice = BOAT_SECTIONS[section as keyof typeof BOAT_SECTIONS];
    // The section's own entries only: the frame above it has its own provider, and a nested
    // provider replaces rather than merges — so this slice has to stand on its own.
    expect(missing(slice, routeEntries(`${BOAT}/${directory}`) as string[])).toEqual([]);
  });

  it("donne à chaque section du bateau son layout", () => {
    const sections = Object.keys(BOAT_SECTIONS).map((section) =>
      section === "haulOuts" ? "haul-outs" : section,
    );
    const withoutLayout = sections.filter(
      (directory) =>
        !(routeEntries(`${BOAT}/${directory}`) as string[]).some((file) =>
          file.endsWith("layout.tsx"),
        ),
    );
    expect(withoutLayout).toEqual([]);
  });

  it("ne déclare jamais un espace de noms qui n'existe pas", () => {
    const declared = new Set<string>([
      ...ROOT,
      ...AUTH,
      ...NEW_BOAT,
      ...ONBOARDING,
      ...PROFILE,
      ...BOAT_SHELL,
      ...Object.values(BOAT_SECTIONS).flat(),
    ]);
    expect([...declared].filter((namespace) => !known.has(namespace))).toEqual([]);
  });

  it("reste plus léger que le fichier entier", () => {
    // The point of the exercise: the heaviest boat screen must stay well under the 43 KB the
    // whole file weighs on the client today.
    const heaviest = Math.max(
      ...Object.values(BOAT_SECTIONS).map((slice) => new Set([...BOAT_SHELL, ...slice]).size),
    );
    expect(heaviest).toBeLessThan(known.size - 8);
  });
});
