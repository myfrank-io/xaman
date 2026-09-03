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
  engine_scope: "none" | "inboard" | "outboard" | "all";
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

  it("ships the three models a boat can fall back on", () => {
    expect(source.templates.map((t) => t.template.external_ref)).toEqual([
      "generic-catamaran-v1",
      "generic-monohull-sail-v1",
      "generic-motor-v1",
    ]);
    for (const entry of source.templates) {
      expect(entry.template.boat_type).toBeTruthy();
      expect(entry.categories.length).toBeGreaterThanOrEqual(7);
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
