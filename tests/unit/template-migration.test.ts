import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  SOURCE,
  TARGET,
  buildTemplateMigration,
  readSource,
} from "../../scripts/gen-template-migration.mjs";

type TemplateItem = {
  external_ref: string;
  label: string;
  description: string | null;
  interval_months: number | null;
  interval_hours: number | null;
  engine_scope: string;
  zone_scope?: string;
  source: string;
  actions: string[];
};
type TemplateCategory = {
  external_ref: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  items: TemplateItem[];
};
type TemplateFile = {
  templates: {
    template: { external_ref: string; name: string; boat_type: string | null };
    categories: TemplateCategory[];
  }[];
};

const source = readSource() as TemplateFile;

/**
 * The generic model registry ships as a generated migration (0016) because production never runs
 * the seed script. These tests are what keeps the generated SQL and its JSON source honest, and
 * what stops a content edit from writing a row the database would reject at apply time.
 */
describe("generic template migration", () => {
  it("matches its source — regenerate with node scripts/gen-template-migration.mjs", () => {
    expect(readFileSync(TARGET, "utf8")).toBe(buildTemplateMigration(source));
  });

  it("ships the four models a boat can fall back on", () => {
    expect(source.templates.map((t) => t.template.external_ref)).toEqual([
      "generic-catamaran-v1",
      "generic-monohull-sail-v1",
      "generic-motor-v1",
      "generic-rib-v1",
    ]);
    for (const entry of source.templates) {
      expect(entry.template.boat_type).toBeTruthy();
      expect(entry.categories.length).toBeGreaterThanOrEqual(6);
    }
  });

  /**
   * D83. The scopes are what 0024's `engine_scope_matches` and its check constraint accept; a
   * typo here would be refused at apply time, on every row after it.
   */
  it("only uses the engine scopes and zone scopes the database knows", () => {
    const scopes = [
      "none",
      "inboard",
      "outboard",
      "all",
      "shaft",
      "saildrive",
      "sterndrive",
      "jet",
    ];
    for (const entry of source.templates) {
      for (const category of entry.categories) {
        for (const item of category.items) {
          expect(scopes, `${entry.template.external_ref}/${item.external_ref}`).toContain(
            item.engine_scope,
          );
          if (item.zone_scope !== undefined) {
            expect(["all", "offshore"]).toContain(item.zone_scope);
          }
        }
      }
    }
  });

  /**
   * « La checklist d'un côtier c'est plus simple » (D83): every model has something to leave out
   * for a coastal boat, and the liferaft is always among it — a coastal boat never carries one.
   */
  it("marks the offshore points on every model", () => {
    for (const entry of source.templates) {
      const offshore = entry.categories.flatMap((c) =>
        c.items.filter((i) => i.zone_scope === "offshore").map((i) => i.external_ref),
      );
      expect(offshore, entry.template.external_ref).toContain("liferaft");
      expect(offshore, entry.template.external_ref).toContain("epirb");
    }
  });

  /**
   * « Quand je mets semi-rigide, que ce soit que des trucs liés au bateau à moteur » (D83): the
   * semi-rigide model never asks about a shaft line, a generator or a toilet, and every point that
   * is about an engine says which drive it is for — so an outboard collects nothing from a Z-drive.
   */
  it("keeps the semi-rigide model to what a semi-rigide has", () => {
    const rib = source.templates.find((t) => t.template.external_ref === "generic-rib-v1");
    expect(rib).toBeDefined();
    const refs = new Set(rib!.categories.flatMap((c) => c.items.map((i) => i.external_ref)));
    for (const absent of [
      "shaft-alignment",
      "stern-gland",
      "generator-service",
      "toilets",
      "air-conditioning",
      "sails",
    ]) {
      expect(refs.has(absent), absent).toBe(false);
    }
    expect(rib!.categories.map((c) => c.external_ref)).toContain("trailer");
    const engines = rib!.categories.find((c) => c.external_ref === "engines")!;
    expect(
      engines.items.filter((i) => i.engine_scope === "outboard").length,
    ).toBeGreaterThanOrEqual(10);
    expect(engines.items.some((i) => i.engine_scope === "jet")).toBe(true);
    expect(engines.items.some((i) => i.engine_scope === "sterndrive")).toBe(true);
  });

  /** A drive-specific point on the motor model names its drive, never « inboard » in general. */
  it("attaches the shaft-line and Z-drive points of the motor model to their drive", () => {
    const motor = source.templates.find((t) => t.template.external_ref === "generic-motor-v1")!;
    const byRef = new Map(motor.categories.flatMap((c) => c.items.map((i) => [i.external_ref, i])));
    for (const ref of ["shaft-alignment", "stern-gland", "shaft-bearing", "propeller"]) {
      expect(byRef.get(ref)?.engine_scope, ref).toBe("shaft");
    }
    for (const ref of ["sterndrive", "sterndrive-oil", "sterndrive-gimbal"]) {
      expect(byRef.get(ref)?.engine_scope, ref).toBe("sterndrive");
    }
    for (const ref of ["jet-wear-ring", "jet-bearings", "jet-intake"]) {
      expect(byRef.get(ref)?.engine_scope, ref).toBe("jet");
    }
  });

  /**
   * `checklist_template_items_hours_need_engine`: an hour interval without an engine scope is
   * rejected by the database. Catching it here names the offending point instead of failing the
   * whole migration on apply.
   */
  it("never puts an hour interval on a point that is not attached to an engine", () => {
    for (const entry of source.templates) {
      for (const category of entry.categories) {
        for (const item of category.items) {
          if (item.interval_hours !== null) {
            expect(
              item.engine_scope,
              `${entry.template.external_ref}/${item.external_ref}`,
            ).not.toBe("none");
          }
        }
      }
    }
  });

  /**
   * Instantiation is idempotent only because every row carries an external_ref: the boat-side
   * unique indexes are `(boat_id, external_ref)`, and in Postgres NULLs never conflict — a point
   * without one would be duplicated on every re-run of `apply_checklist_template`.
   */
  it("gives every category and every point a unique external_ref", () => {
    const templates = new Set<string>();
    for (const entry of source.templates) {
      expect(templates.has(entry.template.external_ref)).toBe(false);
      templates.add(entry.template.external_ref);

      const categories = new Set<string>();
      for (const category of entry.categories) {
        expect(category.external_ref).toBeTruthy();
        expect(categories.has(category.external_ref)).toBe(false);
        categories.add(category.external_ref);

        const items = new Set<string>();
        for (const item of category.items) {
          expect(
            item.external_ref,
            `${entry.template.external_ref}/${category.external_ref}`,
          ).toBeTruthy();
          expect(items.has(item.external_ref)).toBe(false);
          items.add(item.external_ref);
        }
      }
    }
  });

  // Category colours are the art direction's, checked by `boat_categories_color_check`.
  it("uses well-formed hex colours and valid intervals", () => {
    for (const entry of source.templates) {
      for (const category of entry.categories) {
        expect(category.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        for (const item of category.items) {
          for (const interval of [item.interval_months, item.interval_hours]) {
            if (interval !== null) expect(interval).toBeGreaterThan(0);
          }
          expect(Array.isArray(item.actions)).toBe(true);
          expect(["briefing", "proposal", "builder"]).toContain(item.source);
        }
      }
    }
  });

  // Brand voice: no exclamation marks, no emoji (AUDIT §4).
  it("keeps the house voice", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const entry of source.templates) {
      for (const category of entry.categories) {
        for (const item of category.items) {
          const text = [item.label, item.description ?? "", ...item.actions].join(" ");
          expect(text, item.external_ref).not.toContain("!");
          expect(emoji.test(text), item.external_ref).toBe(false);
        }
      }
    }
  });

  it("reads its content from seed/, where a human can edit it", () => {
    expect(SOURCE).toMatch(/seed[/\\]generic-checklists\.json$/);
  });
});
