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
/** La page 3 emprunte les trois lignes de l'accueil (`marketing.preview.*`) plutôt que de les réécrire. */
const DEFINED_AROUND = new Set(flatten(fr.marketing));

/**
 * Les clés que la page lit en dur, plus celles qu'elle compose (`two.${key}Label`). Les familles
 * composées sont listées ici parce qu'une expression ne se relit pas : c'est la liste, et non le
 * gabarit, qui dit ce que la page demandera vraiment à l'exécution.
 */
const COMPOSED = [
  ...["reviews", "service", "xaman"].flatMap((card) => [`two.${card}Label`, `two.${card}Body`]),
  ...["owner", "yard", "market"].flatMap((point) => [`three.${point}Title`, `three.${point}Body`]),
  ...["One", "Two", "Three"].map((n) => `four.ask${n}`),
];

/**
 * Deux lectures ne passent pas par `marketing.brochure` : `generateMetadata`, qui ouvre la
 * tranche `…brochure.meta` et lit donc « title » tout court, et la carte de la page 3, qui
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
  it("lit quatre pages, et pas une de plus", () => {
    for (const page of ["one", "two", "three", "four"]) {
      expect(brochure, page).toHaveProperty(page);
    }
    for (const gone of ["five", "six", "seven"]) {
      expect(brochure, gone).not.toHaveProperty(gone);
    }
    expect(PAGE).toContain("const TOTAL = 4");
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

  it("demande un échange plutôt que de conclure à la place du chantier", () => {
    expect(fr.marketing.brochure.four.title).toMatch(/trente minutes/i);
    expect(PAGE).toContain('t("four.askLabel")');
  });

  it("annonce le programme pilote, comme la page qui la porte", () => {
    expect(fr.marketing.brochure.pilot).toContain("pilote");
    expect(PAGE).toContain('t("pilot")');
  });
});
