import { describe, expect, it } from "vitest";

import {
  SEARCH_KINDS,
  groupSearchHits,
  isSearchable,
  toSearchHit,
  type SearchHit,
} from "@/lib/queries/search";

/**
 * La couche entre `search_boat()` et l'écran (E18-4, D130).
 *
 * Ce qui est fixé ici est ce qu'aucune relecture du SQL ne garantit : qu'une ligne qu'on ne
 * saurait pas ouvrir n'arrive jamais à l'écran, que le regroupement ne réordonne pas ce que la
 * base a classé, et que « continuez à taper » reste distinct de « aucun résultat ».
 */
const row = (over: Partial<Parameters<typeof toSearchHit>[0]> = {}) => ({
  kind: "log",
  id: "11111111-1111-1111-1111-111111111111",
  title: "Vidange moteur",
  subtitle: null,
  happened_at: "2026-03-01",
  amount: 120,
  parent_id: null,
  score: 0.8,
  ...over,
});

describe("isSearchable", () => {
  it("asks for two characters, ignoring the spaces around them", () => {
    expect(isSearchable("")).toBe(false);
    expect(isSearchable("v")).toBe(false);
    expect(isSearchable("  v  ")).toBe(false);
    expect(isSearchable("vi")).toBe(true);
    expect(isSearchable("  vi  ")).toBe(true);
  });
});

describe("toSearchHit", () => {
  it("keeps a line the screen can open", () => {
    expect(toSearchHit(row())).toEqual({
      kind: "log",
      id: "11111111-1111-1111-1111-111111111111",
      title: "Vidange moteur",
      subtitle: null,
      happenedAt: "2026-03-01",
      amount: 120,
      parentId: null,
    });
  });

  it("drops a family the screen does not know how to open", () => {
    // Une huitième famille ajoutée en SQL et pas encore ici : mieux vaut une ligne absente
    // qu'une ligne sans destination.
    expect(toSearchHit(row({ kind: "mooring" }))).toBeNull();
  });

  it("drops a line with no title and one with no id", () => {
    expect(toSearchHit(row({ title: "   " }))).toBeNull();
    expect(toSearchHit(row({ title: null }))).toBeNull();
    expect(toSearchHit(row({ id: null }))).toBeNull();
  });

  it("turns an empty subtitle into no subtitle at all", () => {
    expect(toSearchHit(row({ subtitle: "   " }))?.subtitle).toBe(null);
    expect(toSearchHit(row({ subtitle: " Yanmar " }))?.subtitle).toBe(" Yanmar ".trim());
  });

  it("carries the category of a checklist point, which is where it opens", () => {
    const hit = toSearchHit(
      row({ kind: "item", parent_id: "22222222-2222-2222-2222-222222222222" }),
    );
    expect(hit?.parentId).toBe("22222222-2222-2222-2222-222222222222");
  });
});

describe("groupSearchHits", () => {
  const hit = (kind: SearchHit["kind"], title: string): SearchHit => ({
    kind,
    id: `${kind}-${title}`,
    title,
    subtitle: null,
    happenedAt: null,
    amount: null,
    parentId: null,
  });

  it("orders the families from what was done towards what carries it", () => {
    const groups = groupSearchHits([
      hit("contact", "Chantier"),
      hit("log", "Vidange"),
      hit("part", "Filtre"),
      hit("item", "Contrôle"),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["log", "item", "part", "contact"]);
  });

  it("never shows an empty family", () => {
    const groups = groupSearchHits([hit("log", "Vidange")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe("log");
  });

  it("leaves the order inside a family exactly as the database gave it", () => {
    // Le tri SQL est la similarité du nom puis la date : regrouper ne doit pas le refaire.
    const groups = groupSearchHits([
      hit("log", "Vidange moteur bâbord"),
      hit("log", "Anode"),
      hit("log", "Courroie"),
    ]);
    expect(groups[0]?.hits.map((h) => h.title)).toEqual([
      "Vidange moteur bâbord",
      "Anode",
      "Courroie",
    ]);
  });

  it("has a group for every family the SQL can return", () => {
    const groups = groupSearchHits(SEARCH_KINDS.map((kind) => hit(kind, kind)));
    expect(groups.map((g) => g.kind)).toEqual([...SEARCH_KINDS]);
  });

  it("says nothing when nothing matched", () => {
    expect(groupSearchHits([])).toEqual([]);
  });
});
