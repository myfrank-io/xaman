import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { builderSuggestions, modelSuggestions, type BoatModelOption } from "@/lib/boat-models";

import {
  TARGET,
  buildCatalogueMigration,
  externalRef,
  readSource,
  validate,
} from "../../scripts/gen-boat-models-migration.mjs";

type CatalogueModel = {
  builder: string;
  model: string;
  boatType: string;
  yearFrom?: number | null;
  yearTo?: number | null;
  lengthM?: number | null;
  beamM?: number | null;
  draftM?: number | null;
};

const source = readSource() as { models: CatalogueModel[] };

/**
 * The model catalogue ships as a generated migration (0020) because production never runs the
 * seed script. These tests keep the SQL and its JSON source honest, and stop a content edit from
 * writing a row the database would reject halfway through a deploy.
 */
describe("boat models migration", () => {
  it("matches its source — regenerate with node scripts/gen-boat-models-migration.mjs", () => {
    expect(readFileSync(TARGET, "utf8")).toBe(buildCatalogueMigration(source));
  });

  it("carries enough of the Mediterranean to be worth suggesting", () => {
    expect(source.models.length).toBeGreaterThanOrEqual(100);
    const builders = new Set(source.models.map((m) => m.builder));
    expect(builders.size).toBeGreaterThanOrEqual(20);
  });

  /**
   * The catalogue exists for a product whose first boat is a catamaran, and the open datasets we
   * looked at were ruled out precisely because they carry none. A regression to monohulls only
   * would quietly reintroduce that.
   */
  it("covers multihulls and motor boats, not only monohulls", () => {
    const types = new Map<string, number>();
    for (const m of source.models) types.set(m.boatType, (types.get(m.boatType) ?? 0) + 1);
    expect(types.get("catamaran") ?? 0).toBeGreaterThanOrEqual(20);
    expect(types.get("motor") ?? 0).toBeGreaterThanOrEqual(15);
    expect(types.get("monohull_sail") ?? 0).toBeGreaterThanOrEqual(40);
  });

  // `boat_models_identity` and the unique external_ref: a collision fails the migration on apply,
  // which is a terrible place to find out. `validate` is what the generator runs before writing.
  it("keeps every (builder, model) and every external_ref unique", () => {
    expect(() => validate(source.models)).not.toThrow();
    const refs = source.models.map((m) => externalRef(m.builder, m.model));
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("rejects a payload the database would refuse", () => {
    const ok = { builder: "Chantier", model: "M", boatType: "motor" };
    expect(() => validate([ok, { ...ok }])).toThrow(/duplicate/);
    expect(() => validate([{ ...ok, boatType: "yacht" }])).toThrow(/boatType/);
    expect(() => validate([{ ...ok, yearFrom: 2010, yearTo: 2004 }])).toThrow(/years/);
    expect(() => validate([{ ...ok, lengthM: 0 }])).toThrow(/lengthM/);
    // « Bénéteau Oceanis 40 » in the model column would print twice in the suggestions.
    expect(() => validate([{ ...ok, model: "Chantier M" }])).toThrow(/repeats the builder/);
  });

  /**
   * A model name does not determine a hull — « Oceanis 40 » covers certificates from 11.80 m to
   * 12.15 m — so a dimension the two independent passes did not agree on was left null rather
   * than averaged. What must hold is that what IS there is plausible.
   */
  it("states dimensions only where it has them, and never an implausible one", () => {
    for (const m of source.models) {
      const where = `${m.builder} ${m.model}`;
      expect(m.lengthM, where).toBeTypeOf("number");
      expect(m.lengthM!, where).toBeGreaterThanOrEqual(4);
      expect(m.lengthM!, where).toBeLessThanOrEqual(35);
      if (m.beamM != null) {
        expect(m.beamM, where).toBeLessThan(m.lengthM!);
        expect(m.beamM, where).toBeGreaterThan(1);
      }
      if (m.draftM != null) {
        expect(m.draftM, where).toBeGreaterThan(0.1);
        expect(m.draftM, where).toBeLessThan(5);
      }
      if (m.yearFrom != null) {
        expect(m.yearFrom, where).toBeGreaterThanOrEqual(1960);
        expect(m.yearFrom, where).toBeLessThanOrEqual(2026);
      }
    }
  });

  // A catamaran is wider than it is anything else: half its length or more is the giveaway that a
  // beam landed in the wrong column.
  it("gives multihulls a multihull's beam", () => {
    for (const m of source.models) {
      if (m.boatType !== "catamaran" || m.beamM == null) continue;
      expect(m.beamM / m.lengthM!, `${m.builder} ${m.model}`).toBeGreaterThan(0.35);
    }
  });

  /**
   * The catalogue and the matcher ship together, so they are checked together: everything above
   * says the rows are well-formed, this says they are *findable*. A yard nobody can reach by
   * typing its name is a yard that is not in the product, whatever the table holds.
   */
  it("is reachable through the suggestions that actually ship", () => {
    const rows: BoatModelOption[] = source.models.map((m, i) => ({
      id: String(i),
      builder: m.builder,
      model: m.model,
      boatType: m.boatType as BoatModelOption["boatType"],
      yearFrom: m.yearFrom ?? null,
      yearTo: m.yearTo ?? null,
      lengthM: m.lengthM ?? null,
      beamM: m.beamM ?? null,
      draftM: m.draftM ?? null,
    }));

    // The yards a Mediterranean owner is likeliest to type, found from an unaccented keyboard.
    for (const [typed, expected] of [
      ["bene", "Bénéteau"],
      ["jean", "Jeanneau"],
      ["lag", "Lagoon"],
      ["dufour", "Dufour"],
      ["bavaria", "Bavaria"],
      ["hanse", "Hanse"],
      ["fountaine", "Fountaine Pajot"],
      ["marsaudon", "Marsaudon Composites"],
    ] as const) {
      expect(
        builderSuggestions(rows, typed).map((s) => s.label),
        typed,
      ).toContain(expected);
    }

    // And a yard, once named, offers models rather than an empty row. Two characters, because
    // that is what the screen waits for on a range too long to show whole (MIN_QUERY).
    for (const [yard, typed] of [
      ["Lagoon", "45"],
      ["Bénéteau", "Oce"],
      ["Jeanneau", "Sun"],
      ["Dufour", "39"],
      ["Hanse", "38"],
      ["Fountaine Pajot", "Lu"],
    ] as const) {
      expect(modelSuggestions(rows, yard, typed).length, `${yard} ${typed}`).toBeGreaterThan(0);
    }

    // Lagoon has a model called exactly « 42 », so typing that stops the chips: the field holds
    // the answer, and there is nothing left to offer. Worth pinning on the real catalogue — it is
    // the one place the guard and the data meet.
    expect(modelSuggestions(rows, "Lagoon", "42")).toEqual([]);

    // A short range shows whole with nothing typed at all — three models is a shortlist, not a
    // sample, and the tap is the point.
    expect(modelSuggestions(rows, "Marsaudon", "").map((s) => s.label)).toEqual([
      "ORC 42",
      "TS 42",
      "ORC 50",
    ]);
  });
});
