import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

/**
 * The library of maintenance rules (E17-4, migration `0033`).
 *
 * This table is the one that will put points on people's boats (E17-5): a wrong row here does not
 * cost one carnet, it costs every boat that carries the family. So what is checked is not that the
 * table exists — the RLS suite covers that — but that **the catalogue that shipped is sound**, and
 * that the two promises the schema makes are actually kept by the schema rather than by habit:
 *
 *  - `AUTOPILOT.md §6`, « un intervalle n'est jamais inventé » : anything claiming a source other
 *    than `proposal` has to name it;
 *  - a consumable that E17-8 will push into the stock always names something.
 *
 * Needs a database, like `rls.test.ts`: DATABASE_URL, or the suite skips itself.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

type Rule = {
  external_ref: string;
  kind_ref: string;
  label: string;
  interval_months: number | null;
  interval_hours: number | null;
  engine_scope: string;
  zone_scope: string;
  actions: unknown;
  consumables: unknown;
  source: string;
  source_ref: string | null;
};

describeWithDb("the seeded library of maintenance rules", () => {
  let client: Client;
  let rules: Rule[] = [];

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    const { rows } = await client.query<Rule>(
      `select r.external_ref, k.external_ref as kind_ref, r.label, r.interval_months,
              r.interval_hours, r.engine_scope, r.zone_scope, r.actions, r.consumables,
              r.source, r.source_ref
       from public.maintenance_rules r
       join public.equipment_kinds k on k.id = r.kind_id
       order by r.external_ref`,
    );
    rules = rows;
  });

  afterAll(async () => {
    await client?.end();
  });

  /**
   * « Seed de ~25 familles » is the ticket's own measure, and the number that matters is families
   * covered, not rules written: ten rules on one heater help one boat.
   */
  it("covers at least twenty-five families", () => {
    const families = new Set(rules.map((r) => r.kind_ref));
    expect(rules.length).toBeGreaterThan(0);
    expect(families.size).toBeGreaterThanOrEqual(25);
  });

  it("says something useful on each rule: a label, and steps to follow", () => {
    for (const rule of rules) {
      expect(rule.label.trim(), rule.external_ref).not.toBe("");
      expect(Array.isArray(rule.actions), `${rule.external_ref} actions`).toBe(true);
      expect((rule.actions as string[]).length, `${rule.external_ref} actions`).toBeGreaterThan(0);
    }
  });

  /** A rule with no interval at all would never come due, and would silently never be applied. */
  it("gives every rule an interval", () => {
    for (const rule of rules) {
      expect(
        rule.interval_months !== null || rule.interval_hours !== null,
        `${rule.external_ref} has no interval`,
      ).toBe(true);
    }
  });

  /**
   * The same rule as on a template point: hours are read off an engine, so a rule counted in hours
   * has to say which engine it follows. Enforced by a check constraint — this is the catalogue's
   * side of it.
   */
  it("attaches every hour interval to an engine", () => {
    for (const rule of rules.filter((r) => r.interval_hours !== null)) {
      expect(rule.engine_scope, rule.external_ref).not.toBe("none");
    }
  });

  /** `AUTOPILOT.md §6`: what is not sourced is a proposal, and says so. */
  it("marks as a proposal everything that does not name a source", () => {
    for (const rule of rules) {
      if (rule.source === "proposal") continue;
      expect(rule.source_ref ?? "", `${rule.external_ref} claims ${rule.source}`).not.toBe("");
    }
  });

  /** Offshore gear is not applied to a coastal boat (D90) — the same list `0025` already uses. */
  it("keeps the offshore rules on offshore gear", () => {
    const offshore = rules.filter((r) => r.zone_scope === "offshore").map((r) => r.kind_ref);
    expect(new Set(offshore)).toEqual(new Set(["liferaft", "epirb", "watermaker"]));
  });

  /** Every consumable names something: E17-8 pushes these into the stock as parts. */
  it("names every consumable", () => {
    for (const rule of rules) {
      for (const item of rule.consumables as { name?: string }[]) {
        expect(typeof item?.name, `${rule.external_ref} consumable`).toBe("string");
        expect((item.name ?? "").trim(), `${rule.external_ref} consumable`).not.toBe("");
      }
    }
  });

  it("gives each rule its own key", () => {
    const refs = rules.map((r) => r.external_ref);
    expect(new Set(refs).size).toBe(refs.length);
  });
});

/**
 * The two constraints, seen from the outside. A rule that shipped correctly proves nothing about
 * the next one someone writes — these are what stop it.
 */
describeWithDb("what the table refuses", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  /** Inserts one rule on the winch family and rolls back, whatever happens. */
  async function attempt(columns: string, values: string): Promise<string | null> {
    await client.query("begin");
    try {
      await client.query(
        `insert into public.maintenance_rules (external_ref, kind_id, label, ${columns})
         select 'mr-attempt', id, 'Essai', ${values}
         from public.equipment_kinds where external_ref = 'winch'`,
      );
      return null;
    } catch (e) {
      return (e as { constraint?: string }).constraint ?? (e as Error).message;
    } finally {
      await client.query("rollback");
    }
  }

  it("refuses an authority that names no source", async () => {
    expect(await attempt("source, interval_months", "'manual', 12")).toBe(
      "maintenance_rules_source_needs_ref",
    );
    // The same rule with its reference is accepted, and so is a plain proposal.
    expect(
      await attempt("source, source_ref, interval_months", "'manual', 'Manuel Andersen, p. 8', 12"),
    ).toBeNull();
    expect(await attempt("source, interval_months", "'proposal', 12")).toBeNull();
  });

  it("refuses an interval in hours with no engine", async () => {
    expect(await attempt("interval_hours", "250")).toBe("maintenance_rules_hours_need_engine");
    expect(await attempt("interval_hours, engine_scope", "250, 'inboard'")).toBeNull();
  });

  it("refuses a consumable that names nothing", async () => {
    const shape = "maintenance_rules_consumables_shape";
    expect(await attempt("interval_months, consumables", `12, '[{"quantity": 1}]'::jsonb`)).toBe(
      shape,
    );
    expect(await attempt("interval_months, consumables", `12, '["Filtre"]'::jsonb`)).toBe(shape);
    expect(await attempt("interval_months, consumables", `12, '{"name": "Filtre"}'::jsonb`)).toBe(
      shape,
    );
    expect(
      await attempt("interval_months, consumables", `12, '[{"name": "Filtre à huile"}]'::jsonb`),
    ).toBeNull();
  });
});
