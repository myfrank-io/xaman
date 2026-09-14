import { describe, expect, it } from "vitest";

import { matchEquipmentKind, normaliseForMatch, type EquipmentKind } from "@/lib/equipment-kinds";

/**
 * Which family a piece of equipment looks like (E17-3). The rule proposes; the form's select is
 * what decides. So what is tested here is that it lands on the right one when the words are
 * there, and — more important — that it says nothing rather than guess: a heater filed under the
 * watermaker would give a boat three wrong points and hide three right ones.
 */
const kind = (
  externalRef: string,
  label: string,
  synonyms: string[],
  categoryRef: string | null = null,
): EquipmentKind => ({ id: `id-${externalRef}`, externalRef, label, categoryRef, synonyms });

/** A slice of the catalogue of migration `0032`, in its own order. */
const KINDS: EquipmentKind[] = [
  kind("engine-inboard", "Moteur inbord", ["moteur", "inbord", "yanmar"], "engines"),
  kind("engine-outboard", "Moteur hors-bord", ["hors-bord", "suzuki", "honda"], "engines"),
  kind("mast", "Mât", ["mat", "lorima"], "sails_rigging"),
  kind("winch", "Winch", ["winch", "andersen", "harken"], "sails_rigging"),
  kind("furler", "Emmagasineur / enrouleur", ["emmagasineur", "karver"], "sails_rigging"),
  kind("battery-lithium", "Batterie lithium", ["lithium", "super b"], "energy"),
  kind(
    "watermaker",
    "Dessalinisateur",
    ["dessalinisateur", "aquabase", "aqua base"],
    "plumbing_systems",
  ),
  kind(
    "heater-forced-air",
    "Chauffage à air pulsé",
    ["chauffage", "air pulse", "wallas", "webasto"],
    "plumbing_systems",
  ),
  kind("liferaft", "Radeau de survie", ["radeau", "survitec"], "safety"),
];

describe("normalising what people and documents write", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normaliseForMatch("Chauffage Wallas 30DT, air pulsé")).toBe(
      "chauffage wallas 30dt air pulse",
    );
    expect(normaliseForMatch("  Mât  carbone  ")).toBe("mat carbone");
  });

  it("keeps « & » as a word, so a brand written B&G survives", () => {
    expect(normaliseForMatch("Pack B&G")).toBe("pack b&g");
  });

  /**
   * `normalize("NFD")` undoes an accent put on a letter; `œ æ ø` are letters of their own, so it
   * leaves them alone and the punctuation step used to swallow them — « Cœur » came out `c ur`
   * (E17-12). The SQL twin went through its own accent table and had the same blind spot, so the
   * two agreed on the wrong answer. `text_fold` has folded these since `0005`.
   */
  it("folds the ligatures instead of dropping them", () => {
    expect(normaliseForMatch("Cœur")).toBe("coeur");
    expect(normaliseForMatch("NŒUD de chaise")).toBe("noeud de chaise");
    expect(normaliseForMatch("Ærø")).toBe("aero");
  });
});

describe("the family an equipment looks like", () => {
  it("reads the name", () => {
    expect(matchEquipmentKind({ name: "Radeau de survie 10 personnes" }, KINDS)?.externalRef).toBe(
      "liferaft",
    );
    expect(matchEquipmentKind({ name: "Dessalinisateur 65 L/h" }, KINDS)?.externalRef).toBe(
      "watermaker",
    );
  });

  it("reads the brand and the model too, because that is how gear is named", () => {
    expect(
      matchEquipmentKind({ name: "Batteries Lithium", brand: "Super B" }, KINDS)?.externalRef,
    ).toBe("battery-lithium");
    expect(
      matchEquipmentKind({ name: "Emmagasineurs Karver", brand: "Karver" }, KINDS)?.externalRef,
    ).toBe("furler");
    expect(matchEquipmentKind({ name: "Mât carbone", brand: "Lorima" }, KINDS)?.externalRef).toBe(
      "mast",
    );
  });

  /** The whole reason the catalogue carries brand names: nobody writes « chauffage à air pulsé ». */
  it("recognises the yard's wording, accents and all", () => {
    expect(
      matchEquipmentKind({ name: "Chauffage fuel Wallas 30DT, air pulsé" }, KINDS)?.externalRef,
    ).toBe("heater-forced-air");
    expect(
      matchEquipmentKind({ name: "Dessalinisateur Aqua Base 65 L/h" }, KINDS)?.externalRef,
    ).toBe("watermaker");
  });

  /** « Winch électrique pied de mât » carries two families; the longest term is the right one. */
  it("prefers the longest term when several families are named", () => {
    const kinds = [
      kind("generic", "Chauffage", ["chauffage"]),
      kind("forced-air", "Chauffage à air pulsé", ["chauffage a air pulse"]),
    ];
    expect(matchEquipmentKind({ name: "Chauffage à air pulsé Wallas" }, kinds)?.externalRef).toBe(
      "forced-air",
    );
  });

  /**
   * No family of `0032` carries a ligature today, but the catalogue is French and the terms come
   * off a yard's papers — « œil de pont », « cœur de cordage ». The two spellings of the same word
   * have to land on the same family, whichever side the ligature is on.
   */
  it("reads a ligature the same whether the paper or the catalogue spells it out", () => {
    const spelledOut = [kind("padeye", "Oeil de pont", ["oeil de pont"])];
    const withLigature = [kind("padeye", "Œil de pont", ["œil de pont"])];
    for (const kinds of [spelledOut, withLigature]) {
      expect(matchEquipmentKind({ name: "Œil de pont bâbord" }, kinds)?.externalRef).toBe("padeye");
      expect(matchEquipmentKind({ name: "Oeil de pont bâbord" }, kinds)?.externalRef).toBe(
        "padeye",
      );
    }
  });

  it("matches whole words only", () => {
    // « mat » must not be found inside « format », « matelas » or « climatisation ».
    expect(matchEquipmentKind({ name: "Matelas de la cabine avant" }, KINDS)).toBeNull();
    expect(matchEquipmentKind({ name: "Climatisation du carré" }, KINDS)).toBeNull();
  });

  it("says nothing rather than guess", () => {
    expect(matchEquipmentKind({ name: "Cloison de mât + poutre arrière" }, KINDS)?.externalRef)
      // « mât » is there as a whole word: the cloison is named after it. A wrong family is the
      // cost of matching on words, and it is why the form always shows what it proposed.
      .toBe("mast");
    expect(matchEquipmentKind({ name: "Trampoline" }, KINDS)).toBeNull();
    expect(matchEquipmentKind({ name: "" }, KINDS)).toBeNull();
    expect(matchEquipmentKind({ name: "Winch" }, [])).toBeNull();
  });

  it("is not fooled by an empty brand or model", () => {
    expect(
      matchEquipmentKind({ name: "Winch bâbord", brand: null, model: null }, KINDS)?.externalRef,
    ).toBe("winch");
  });
});
