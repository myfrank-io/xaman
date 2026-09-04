import { describe, expect, it } from "vitest";

import {
  MAX_SUGGESTIONS,
  MIN_QUERY,
  builderSuggestions,
  findModel,
  findModelById,
  modelSuggestions,
  type BoatModelOption,
} from "@/lib/boat-models";

function boat(over: Partial<BoatModelOption> & { id: string }): BoatModelOption {
  return {
    builder: "Chantier",
    model: "Modèle",
    boatType: "monohull_sail",
    yearFrom: null,
    yearTo: null,
    lengthM: null,
    beamM: null,
    draftM: null,
    ...over,
  };
}

const CATALOGUE: BoatModelOption[] = [
  boat({
    id: "orc50",
    builder: "Marsaudon Composites",
    model: "ORC 50",
    boatType: "catamaran",
    lengthM: 15.24,
  }),
  boat({
    id: "orc57",
    builder: "Marsaudon Composites",
    model: "ORC 57",
    boatType: "catamaran",
    lengthM: 17.2,
  }),
  boat({ id: "oceanis", builder: "Bénéteau", model: "Oceanis 46.1", lengthM: 14.6 }),
  boat({ id: "first-b", builder: "Bénéteau", model: "First 40", lengthM: 12.0 }),
  boat({ id: "first-d", builder: "Dehler", model: "First 40", lengthM: 12.1 }),
];

describe("builderSuggestions", () => {
  /**
   * Nothing before two characters. With a few hundred models the first five in alphabetical order
   * are not a shortlist, and putting them up front makes the form read as a menu of the boats we
   * accept — which is the opposite of what free text is for.
   */
  it("says nothing until there is something to narrow by", () => {
    expect(builderSuggestions(CATALOGUE, "")).toEqual([]);
    expect(builderSuggestions(CATALOGUE, "B")).toEqual([]);
    expect(builderSuggestions(CATALOGUE, "Bé").map((s) => s.label)).toEqual(["Bénéteau"]);
    expect(MIN_QUERY).toBe(2);
  });

  it("proposes the yards it knows, alphabetically, matching anywhere in the name", () => {
    const yards = [
      boat({ id: "1", builder: "Zodiac" }),
      boat({ id: "2", builder: "Amel" }),
      boat({ id: "3", builder: "Elan" }),
    ];
    // « el » is inside Amel and Elan and nothing else: the order is the yard's name, and it
    // matches anywhere in the name rather than only at the start.
    expect(builderSuggestions(yards, "el").map((s) => s.label)).toEqual(["Amel", "Elan"]);
  });

  it("finds an accented builder from an unaccented keyboard", () => {
    expect(builderSuggestions(CATALOGUE, "beneteau").map((s) => s.label)).toEqual(["Bénéteau"]);
    expect(builderSuggestions(CATALOGUE, "BENETEAU").map((s) => s.label)).toEqual(["Bénéteau"]);
  });

  it("stops only on an exact match, so « beneteau » still gets its accents back", () => {
    expect(builderSuggestions(CATALOGUE, "Bénéteau")).toEqual([]);
    expect(builderSuggestions(CATALOGUE, "beneteau")).not.toEqual([]);
  });

  it("suggests nothing for a yard it does not know", () => {
    expect(builderSuggestions(CATALOGUE, "Neel")).toEqual([]);
  });
});

describe("modelSuggestions", () => {
  /**
   * A yard already named is itself the narrowing, so its whole range shows with nothing typed —
   * as long as it fits on the row. Anything wider waits, like the builder field does.
   */
  it("shows a named yard's whole range, and waits when the scope is still the catalogue", () => {
    expect(modelSuggestions(CATALOGUE, "Marsaudon", "").map((s) => s.label)).toEqual([
      "ORC 50",
      "ORC 57",
    ]);
    const wide = Array.from({ length: 12 }, (_, i) =>
      boat({ id: `w${i}`, builder: "Grand Chantier", model: `Modèle ${i}` }),
    );
    expect(modelSuggestions(wide, "Grand Chantier", "")).toEqual([]);
    expect(modelSuggestions(wide, "Grand Chantier", "Mod").length).toBe(MAX_SUGGESTIONS);
  });

  /**
   * With no yard there is no narrowing, whatever the catalogue's size. A small catalogue must not
   * quietly turn the model field into a menu of every boat we know — the rule is about there
   * being an answer to give, not about the list fitting on the row.
   */
  it("says nothing with neither a yard nor a query, even on a tiny catalogue", () => {
    expect(modelSuggestions(CATALOGUE.slice(0, 3), "", "")).toEqual([]);
    expect(modelSuggestions(CATALOGUE.slice(0, 3), "", "O")).toEqual([]);
  });

  it("names the yard on the chip only while the builder box is empty", () => {
    const wide = modelSuggestions(CATALOGUE, "", "First 40");
    expect(wide.map((s) => s.hint)).toEqual(["Bénéteau", "Dehler"]);
    expect(modelSuggestions(CATALOGUE, "Dehler", "First").map((s) => s.hint)).toEqual([undefined]);
  });

  it("carries the row id, so two identically named models stay distinguishable", () => {
    expect(modelSuggestions(CATALOGUE, "", "First 40").map((s) => s.key)).toEqual([
      "first-b",
      "first-d",
    ]);
  });

  it("suggests nothing for a builder it does not know", () => {
    expect(modelSuggestions(CATALOGUE, "Neel", "")).toEqual([]);
    expect(modelSuggestions(CATALOGUE, "Neel", "47")).toEqual([]);
  });

  it("never floods the screen", () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      boat({ id: `m${i}`, builder: `Chantier ${i}`, model: `Modèle ${i}` }),
    );
    expect(builderSuggestions(many, "Chantier").length).toBe(MAX_SUGGESTIONS);
    expect(modelSuggestions(many, "", "Modèle").length).toBe(MAX_SUGGESTIONS);
  });
});

describe("findModel", () => {
  it("recognises a model typed in full, accents and case aside", () => {
    expect(findModel(CATALOGUE, "marsaudon composites", "orc 50")?.id).toBe("orc50");
    expect(findModel(CATALOGUE, "BÉNÉTEAU", "Oceanis 46.1")?.id).toBe("oceanis");
  });

  /**
   * A name shared by two yards with no builder to disambiguate: the first match is returned, and
   * the caller has offered a chip per yard precisely so that this case is normally settled by a
   * tap rather than here.
   */
  it("still answers when only the model is known", () => {
    expect(findModel(CATALOGUE, "", "First 40")?.id).toBe("first-b");
  });

  it("does not match a boat the catalogue has never heard of", () => {
    expect(findModel(CATALOGUE, "Neel", "47")).toBeNull();
    expect(findModel(CATALOGUE, "Bénéteau", "")).toBeNull();
  });

  it("refuses a model that belongs to another yard", () => {
    expect(findModel(CATALOGUE, "Lagoon", "ORC 50")).toBeNull();
  });
});

describe("findModelById", () => {
  it("resolves the id a chip carries", () => {
    expect(findModelById(CATALOGUE, "orc57")?.model).toBe("ORC 57");
    expect(findModelById(CATALOGUE, "nope")).toBeNull();
  });
});
