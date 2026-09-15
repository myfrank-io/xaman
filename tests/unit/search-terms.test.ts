import { describe, expect, it } from "vitest";

import { MAX_SEARCH_TERMS, highlightSegments, isSearchable, searchTerms } from "@/lib/search-terms";

/**
 * Le découpage de la question, côté écran (E18-14).
 *
 * Ce qui est fixé ici est ce que la base ne peut pas dire : si la question est posée — la réponse
 * arrive **avant** l'appel —, et ce qu'il faut surligner dans du texte déjà rendu. La parité avec
 * `public.search_terms()` est vérifiée séparément, sur une vraie base
 * (`tests/unit/search-sql.test.ts`).
 */
describe("searchTerms", () => {
  it("coupe la question en mots", () => {
    expect(searchTerms("vidange babord")).toEqual(["vidange", "babord"]);
  });

  it("rend le mot le plus long d'abord — c'est lui que l'index servira", () => {
    expect(searchTerms("cale pompe de")).toEqual(["pompe", "cale", "de"]);
  });

  it("replie les accents et les majuscules", () => {
    expect(searchTerms("Carénage BÂBORD")).toEqual(["carenage", "babord"]);
  });

  it("ne répète pas un mot tapé deux fois", () => {
    expect(searchTerms("moteur moteur")).toEqual(["moteur"]);
  });

  it("ne laisse passer aucun joker LIKE", () => {
    // « 100% » cherchait `%100%%` avant `0040`, et « % » sortait le carnet entier.
    expect(searchTerms("100%")).toEqual(["100"]);
    expect(searchTerms("%")).toEqual([]);
    expect(searchTerms("_")).toEqual([]);
    expect(searchTerms("a\\b")).toEqual(["a", "b"]);
  });

  it("s'arrête à six mots", () => {
    const terms = searchTerms("un deux trois quatre cinq six sept huit");
    expect(terms).toHaveLength(MAX_SEARCH_TERMS);
  });

  it("ne rend rien d'une frappe qui n'est que ponctuation ou espaces", () => {
    expect(searchTerms("   ")).toEqual([]);
    expect(searchTerms("—…!")).toEqual([]);
  });
});

describe("isSearchable", () => {
  it("demande deux caractères sur le mot le plus long, pas sur la frappe", () => {
    // « a. » fait deux caractères et ne cherche rien ; « 4L » en fait deux et cherche un moteur.
    expect(isSearchable("a.")).toBe(false);
    expect(isSearchable("4L")).toBe(true);
    expect(isSearchable("")).toBe(false);
    expect(isSearchable("  vi  ")).toBe(true);
  });

  it("refuse une frappe qui n'est que des jokers, si longue soit-elle", () => {
    // Le cas qui sortait tout le carnet : deux caractères de long, aucun mot dedans.
    expect(isSearchable("%%")).toBe(false);
    expect(isSearchable("%_%")).toBe(false);
  });

  it("accepte dès qu'un seul mot est assez long", () => {
    expect(isSearchable("a vidange")).toBe(true);
  });
});

describe("highlightSegments", () => {
  const marked = (text: string, query: string) =>
    highlightSegments(text, searchTerms(query))
      .filter((segment) => segment.match)
      .map((segment) => segment.text);

  it("rend le texte entier quand il n'y a rien à chercher", () => {
    expect(highlightSegments("Vidange", [])).toEqual([{ text: "Vidange", match: false }]);
  });

  it("marque le mot trouvé sans toucher au reste", () => {
    expect(highlightSegments("Vidange moteur", ["moteur"])).toEqual([
      { text: "Vidange ", match: false },
      { text: "moteur", match: true },
    ]);
  });

  it("recolle le texte à l'identique, accents et majuscules compris", () => {
    const text = "Vidange moteur bâbord";
    const rebuilt = highlightSegments(text, searchTerms("babord vidange"))
      .map((segment) => segment.text)
      .join("");
    expect(rebuilt).toBe(text);
  });

  it("trouve un mot accentué à partir d'une frappe sans accent", () => {
    // C'est tout l'intérêt : on tape « babord », le carnet écrit « bâbord ».
    expect(marked("Vidange moteur bâbord", "babord")).toEqual(["bâbord"]);
    expect(marked("Carénage complet", "carenage")).toEqual(["Carénage"]);
  });

  it("marque chacun des mots de la question, où qu'il soit", () => {
    expect(marked("Vidange moteur bâbord", "babord vidange")).toEqual(["Vidange", "bâbord"]);
  });

  it("préfère le mot long quand deux mots de la question se chevauchent", () => {
    // Les mots arrivent du plus long au plus court, et l'alternance prend le premier qui accroche.
    expect(marked("Courroie d'alternateur", "cour courroie")).toEqual(["Courroie"]);
  });

  it("marque toutes les occurrences, pas seulement la première", () => {
    expect(marked("Courroie et contre-courroie", "courroie")).toEqual(["Courroie", "courroie"]);
  });
});
