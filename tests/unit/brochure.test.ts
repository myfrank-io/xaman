import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import fr from "@/messages/fr.json";

/**
 * La présentation constructeur, lue sur le site (E19-10, E19-12, D155).
 *
 * La page `/constructeurs/brochure` dessine ses pages avec les jetons de `globals.css` — donc
 * tout le texte vit dans `fr.json` (règle 7), et rien ne garantit plus, à la lecture du
 * composant, que les deux ensembles coïncident. C'est ce que ces cas vérifient : aucune clé lue
 * qui n'existe, aucune chaîne écrite que personne ne lit.
 *
 * Et une règle qui n'est pas de la mise en page. La version à sept pages avait été écrite pour un
 * chantier nommé, et n'en gardait le nom qu'en page 4, dans la fonction de l'homme cité. Cette
 * citation n'a jamais pu être vérifiée à la source ; elle est partie avec les trois pages
 * d'argumentaire (D155). Le prospect n'est donc plus nommé nulle part, et ce cas est là pour que
 * personne ne l'y remette sans le décider.
 */
const PAGE = readFileSync(join(process.cwd(), "src/app/constructeurs/brochure/page.tsx"), "utf8");

const brochure = fr.marketing.brochure as unknown as Record<string, unknown>;

/** Toutes les clés « a.b » du sous-arbre, aplaties. */
function flatten(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

const DEFINED = new Set(flatten(brochure));
/** La page 4 emprunte les trois lignes de l'accueil (`marketing.preview.*`) plutôt que de les réécrire. */
const DEFINED_AROUND = new Set(flatten(fr.marketing));

/**
 * Les clés que la page lit en dur, plus celles qu'elle compose (`two.stat${n}Value`). Les familles
 * composées sont listées ici parce qu'une expression ne se relit pas : c'est la liste, et non le
 * gabarit, qui dit ce que la page demandera vraiment à l'exécution.
 */
const MOMENTS = ["Sale", "Care", "Resale"];
const COMPOSED = [
  ...["One", "Two", "Three"].flatMap((n) => [`two.stat${n}Value`, `two.stat${n}Label`]),
  ...MOMENTS.map((moment) => `three.moment${moment}`),
  ...["car", "boat"].flatMap((side) => [
    `three.${side}Label`,
    ...MOMENTS.map((moment) => `three.${side}${moment}`),
  ]),
  ...["One", "Two", "Three"].flatMap((n) => [`four.journal${n}`, `four.journal${n}Meta`]),
  ...["Boat", "Item", "State", "Last"].flatMap((row) => [
    `five.handoff${row}Label`,
    `five.handoff${row}Value`,
  ]),
  ...["Cover", "Claim"].flatMap((row) => [`five.warranty${row}Label`, `five.warranty${row}Value`]),
  ...["One", "Two", "Three"].map((n) => `six.ask${n}`),
];

/**
 * Deux lectures ne passent pas par `marketing.brochure` : `generateMetadata`, qui ouvre la
 * tranche `…brochure.meta` et lit donc « title » tout court, et la carte de la page 4, qui
 * emprunte `marketing` pour réutiliser les trois lignes de l'accueil. On ramène les deux au même
 * repère avant de comparer — d'où la coupure au `export default`, qui sépare les deux portées.
 */
const CUT = PAGE.indexOf("export default");
const SCOPES: readonly [string, string][] = [
  [PAGE.slice(0, CUT), "meta."],
  [PAGE.slice(CUT), ""],
];

const LITERAL = SCOPES.flatMap(([source, prefix]) =>
  [...source.matchAll(/\bt\("([\w.]+)"/g)].map((match) =>
    `${prefix}${match[1]}`.replace(/^brochure\./, ""),
  ),
);
const READ = new Set([...LITERAL, ...COMPOSED]);

describe("la brochure et ses mots", () => {
  it("lit six pages, et pas une de plus", () => {
    for (const page of ["one", "two", "three", "four", "five", "six"]) {
      expect(brochure, page).toHaveProperty(page);
    }
    expect(brochure).not.toHaveProperty("seven");
    expect(PAGE).toContain("const TOTAL = 6");
  });

  it("présente l'outil par ses quatre éléments, et marque celui que le pilote construit", () => {
    const { four, five } = fr.marketing.brochure;
    expect([
      four.preventiveTitle,
      four.historyTitle,
      five.supportTitle,
      five.warrantyTitle,
    ]).toEqual([
      "Maintenance préventive",
      "Historique des interventions",
      "Accompagnement",
      "Logique de garantie constructeur",
    ]);
    // La garantie n'existe pas encore dans l'app (E19-2, E19-3) : la page le dit, et sa carte
    // est un exemple, pas la lecture d'un bateau.
    expect(five.warrantyTag).toMatch(/pilote/);
    expect(five.warrantyLabel).toMatch(/^Exemple/);
    expect(PAGE).toContain('tag={t("five.warrantyTag")}');
  });

  it("met l'automobile et le nautisme face à face, aux trois mêmes moments", () => {
    const three = fr.marketing.brochure.three as Record<string, string>;
    for (const side of ["car", "boat"]) {
      for (const moment of MOMENTS)
        expect(three[`${side}${moment}`], `${side}${moment}`).toBeTruthy();
    }
  });

  it("ne lit aucune clé qui n'existe pas", () => {
    const missing = [...READ].filter((key) => !DEFINED.has(key) && !DEFINED_AROUND.has(key));
    expect(missing).toEqual([]);
  });

  it("n'écrit aucune chaîne que personne ne lit", () => {
    // `nav.*` et `meta.*` partent en props ou en métadonnées, donc sous leur nom complet ;
    // tout le reste est lu par la page.
    const unread = [...DEFINED].filter((key) => !READ.has(key));
    expect(unread).toEqual([]);
  });
});

describe("ce que la version publique ne dit pas", () => {
  it("ne nomme aucun prospect", () => {
    const named = [...DEFINED].filter((key) => {
      const value = key
        .split(".")
        .reduce<unknown>((node, step) => (node as Record<string, unknown>)?.[step], brochure);
      return typeof value === "string" && /Grand Large|Wauquiez|Outremer/.test(value);
    });
    expect(named).toEqual([]);
  });

  it("finit sur deux personnes à qui écrire, et sur rien d'autre", () => {
    const six = fr.marketing.brochure.six;
    expect(six.title).toMatch(/30 minutes/);
    for (const email of [six.contactOne, six.contactTwo]) {
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[a-z]+$/);
    }
    expect(PAGE).toContain("href={`mailto:${email}?subject=${subject}`}");
    // Envoyée seule, en lien ou en PDF, à quelqu'un qui n'a pas vu la page de l'offre : ni
    // retour vers elle, ni la boîte `constructeurs@` de l'offre, qui n'existe pas encore (E19-9).
    expect(PAGE).not.toContain('href="/constructeurs"');
    expect(PAGE).not.toContain("cta.email");
    expect(brochure.nav).not.toHaveProperty("back");
  });

  it("écrit MyFrank comme MyFrank l'écrit", () => {
    const all = flatten(brochure).map((key) =>
      key
        .split(".")
        .reduce<unknown>((node, step) => (node as Record<string, unknown>)?.[step], brochure),
    );
    expect(all.some((value) => typeof value === "string" && value.includes("MyFrank"))).toBe(true);
    expect(all.filter((value) => typeof value === "string" && /\bmyFrank\b/.test(value))).toEqual(
      [],
    );
  });

  it("annonce le programme pilote, comme la page qui la porte", () => {
    expect(fr.marketing.brochure.pilot).toContain("pilote");
    expect(PAGE).toContain('t("pilot")');
  });
});
