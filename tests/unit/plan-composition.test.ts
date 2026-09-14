import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

import { normaliseForMatch } from "@/lib/equipment-kinds";

/**
 * The plan composes itself from what is aboard (E17-5, migration `0035`).
 *
 * `docs/AUTOPILOT.md §4`: a boat's plan is « points du modèle de coque + règles des équipements
 * présents ». The hull half has been applied by `apply_checklist_template` since `0003`; this is
 * the other half, and what is checked here is the part that only shows up against a real database:
 * that the right points appear, in the right system, on the right engine, once — and that they
 * come and go with the equipment without ever taking a completion with them.
 *
 * Needs a database, like `rls.test.ts`: DATABASE_URL, or the suite skips itself.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

const BOAT = "00000000-0000-0000-0000-00000000b001";
/** The owner of the seeded boat — `compose_*` writes `created_by`, so someone has to be signed in. */
const OWNER = "00000000-0000-0000-0000-000000000011";

/** `noUncheckedIndexedAccess` is on: this says « there is a row » once instead of at every read. */
function first<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (row === undefined) throw new Error(`expected at least one ${what}`);
  return row;
}

type Point = {
  external_ref: string;
  label: string;
  is_active: boolean;
  engine_id: string | null;
  equipment_id: string | null;
  source: string;
  category_ref: string | null;
  interval_months: number | null;
  interval_hours: number | null;
};

describeWithDb("the equipment layer of a boat's plan", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  /**
   * Everything runs inside one transaction that is rolled back, signed in as the boat's owner —
   * the trigger writes `created_by` from `auth.uid()`, and a plan nobody owns is not the case
   * under test.
   */
  async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await client.query("begin");
    try {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: OWNER, email: "owner@test.xaman", role: "authenticated" }),
      ]);
      return await fn();
    } finally {
      await client.query("rollback");
    }
  }

  /** Gives the boat the system a family expects, so the fallback has something to resolve to. */
  async function addCategory(externalRef: string, name: string): Promise<string> {
    const { rows } = await client.query<{ id: string }>(
      `insert into public.boat_categories (boat_id, name, color, icon, sort_order, external_ref)
       values ($1, $2, '#0ea5e9', 'droplets', 50, $3)
       on conflict (boat_id, external_ref) do update set name = excluded.name
       returning id`,
      [BOAT, name, externalRef],
    );
    return first(rows, "boat category").id;
  }

  async function addEquipment(
    id: string,
    kindRef: string,
    values: { name: string; brand?: string | null; categoryId?: string | null; ref?: string },
  ): Promise<void> {
    await client.query(
      `insert into public.equipment (id, boat_id, name, brand, kind_id, category_id, external_ref)
       select $1, $2, $3, $4, k.id, $5, $6
       from public.equipment_kinds k where k.external_ref = $7`,
      [
        id,
        BOAT,
        values.name,
        values.brand ?? null,
        values.categoryId ?? null,
        values.ref ?? id,
        kindRef,
      ],
    );
  }

  async function pointsOf(equipmentId?: string): Promise<Point[]> {
    const { rows } = await client.query<Point>(
      `select ci.external_ref, ci.label, ci.is_active, ci.engine_id, ci.equipment_id,
              ci.source::text as source, bc.external_ref as category_ref,
              ci.interval_months, ci.interval_hours
       from public.checklist_items ci
       join public.boat_categories bc on bc.id = ci.category_id
       where ci.boat_id = $1 and ci.rule_id is not null
         and ($2::uuid is null or ci.equipment_id = $2)
       order by ci.external_ref`,
      [BOAT, equipmentId ?? null],
    );
    return rows;
  }

  it("puts the family's rules on the boat, and says what each one maintains", async () => {
    await inTransaction(async () => {
      const category = await addCategory("plumbing_systems", "Hydraulique & Circuits");
      await addEquipment("00000000-0000-0000-0000-0000000000e1", "heater-forced-air", {
        name: "Chauffage Wallas 30DT",
        brand: "Wallas",
        categoryId: category,
        ref: "eq-heater",
      });

      const points = await pointsOf("00000000-0000-0000-0000-0000000000e1");
      expect(points).toHaveLength(1);
      const point = first(points, "point");
      expect(point.external_ref).toBe("rule:heater-forced-air-service:eq-heater");
      // The equipment names the point: two heaters aboard must not give two identical lines.
      expect(point.label).toBe("Réviser le chauffage à air pulsé — Chauffage Wallas 30DT");
      expect(point.source).toBe("rule");
      expect(point.engine_id).toBeNull();
      expect(point.interval_months).toBe(12);
    });
  });

  /** No category on the equipment: the family says where it usually lives (`category_ref`). */
  it("files a point under the family's usual system when nobody filed the equipment", async () => {
    await inTransaction(async () => {
      await addCategory("plumbing_systems", "Hydraulique & Circuits");
      await addEquipment("00000000-0000-0000-0000-0000000000e2", "watermaker", {
        name: "Dessalinisateur Aqua Base",
        categoryId: null,
        ref: "eq-watermaker",
      });
      const points = await pointsOf("00000000-0000-0000-0000-0000000000e2");
      expect(points.length).toBeGreaterThan(0);
      for (const point of points) expect(point.category_ref).toBe("plumbing_systems");
    });
  });

  /**
   * A point cannot exist without a system, and putting a watermaker's service under whichever
   * system came first is worse than proposing nothing. So nothing is proposed.
   */
  it("proposes nothing rather than guess a system", async () => {
    await inTransaction(async () => {
      // The seeded boat has « engines » and nothing else: no `safety` to fall back on.
      await addEquipment("00000000-0000-0000-0000-0000000000e3", "liferaft", {
        name: "Radeau Plastimo",
        categoryId: null,
        ref: "eq-raft",
      });
      expect(await pointsOf("00000000-0000-0000-0000-0000000000e3")).toEqual([]);
    });
  });

  /** An hour interval is read off an engine, so the rule multiplies per matching engine (D90). */
  it("gives an engine-scoped rule one point per matching engine, named after it", async () => {
    await inTransaction(async () => {
      const category = await addCategory("engines", "Moteurs");
      await addEquipment("00000000-0000-0000-0000-0000000000e4", "engine-inboard", {
        name: "Yanmar 4JH57",
        categoryId: category,
        ref: "eq-engine",
      });
      const points = await pointsOf("00000000-0000-0000-0000-0000000000e4");
      expect(points.length).toBeGreaterThan(0);
      for (const point of points) {
        expect(point.engine_id, point.external_ref).not.toBeNull();
        // The engine is the subject here, so the engine names the point.
        expect(point.label, point.external_ref).toMatch(/ — Moteur$/);
      }
      const withHours = points.filter((p) => p.interval_hours !== null);
      expect(withHours.length).toBeGreaterThan(0);
    });
  });

  /** Rule 11: running the composition again adds nothing. */
  it("is idempotent", async () => {
    await inTransaction(async () => {
      const category = await addCategory("plumbing_systems", "Hydraulique & Circuits");
      await addEquipment("00000000-0000-0000-0000-0000000000e5", "heater-forced-air", {
        name: "Chauffage Wallas",
        categoryId: category,
        ref: "eq-heater-2",
      });
      const before = (await pointsOf()).length;
      const { rows } = await client.query<{ added: number }>(
        "select public.apply_maintenance_rules($1) as added",
        [BOAT],
      );
      expect(Number(first(rows, "count").added)).toBe(0);
      expect((await pointsOf()).length).toBe(before);
    });
  });

  /** D90: a coastal boat does not carry the offshore rules, same as on a template point. */
  it("leaves the offshore rules off a coastal boat", async () => {
    await inTransaction(async () => {
      await addCategory("plumbing_systems", "Hydraulique & Circuits");
      await client.query("update public.boats set navigation_zone = 'coastal' where id = $1", [
        BOAT,
      ]);
      await addEquipment("00000000-0000-0000-0000-0000000000e6", "watermaker", {
        name: "Dessalinisateur",
        ref: "eq-watermaker-coastal",
      });
      expect(await pointsOf("00000000-0000-0000-0000-0000000000e6")).toEqual([]);
    });
  });

  /** No family, no rules — and no guess. `kind_id` null is the normal state of an unfiled row. */
  it("says nothing about an equipment nobody has filed under a family", async () => {
    await inTransaction(async () => {
      const category = await addCategory("plumbing_systems", "Hydraulique & Circuits");
      await client.query(
        `insert into public.equipment (id, boat_id, name, category_id, external_ref)
         values ($1, $2, 'Cloison de mât', $3, 'eq-bulkhead')`,
        ["00000000-0000-0000-0000-0000000000e7", BOAT, category],
      );
      expect(await pointsOf("00000000-0000-0000-0000-0000000000e7")).toEqual([]);
    });
  });

  describe("when the equipment comes and goes", () => {
    const HEATER = "00000000-0000-0000-0000-0000000000e8";

    async function setUp(): Promise<void> {
      const category = await addCategory("plumbing_systems", "Hydraulique & Circuits");
      await addEquipment(HEATER, "heater-forced-air", {
        name: "Chauffage Wallas",
        categoryId: category,
        ref: "eq-heater-3",
      });
    }

    it("stops asking once it is « déposé », and asks again when it comes back", async () => {
      await inTransaction(async () => {
        await setUp();
        expect((await pointsOf(HEATER)).every((p) => p.is_active)).toBe(true);

        await client.query("update public.equipment set removed_at = current_date where id = $1", [
          HEATER,
        ]);
        const removed = await pointsOf(HEATER);
        expect(removed.length).toBeGreaterThan(0);
        expect(
          removed.every((p) => !p.is_active),
          "deactivated, not deleted",
        ).toBe(true);

        await client.query("update public.equipment set removed_at = null where id = $1", [HEATER]);
        expect((await pointsOf(HEATER)).every((p) => p.is_active)).toBe(true);
      });
    });

    it("does the same when the line goes to the trash and comes back", async () => {
      await inTransaction(async () => {
        await setUp();
        await client.query("update public.equipment set deleted_at = now() where id = $1", [
          HEATER,
        ]);
        expect((await pointsOf(HEATER)).every((p) => !p.is_active)).toBe(true);
        await client.query("update public.equipment set deleted_at = null where id = $1", [HEATER]);
        expect((await pointsOf(HEATER)).every((p) => p.is_active)).toBe(true);
      });
    });

    /**
     * The reason points are deactivated and never deleted. `checklist_completions` cascades from
     * `checklist_items`: a delete here would erase the record of work that was really done, which
     * is the one thing a carnet exists to keep.
     */
    it("keeps the record of what was done after the equipment is purged", async () => {
      await inTransaction(async () => {
        await setUp();
        const point = first(await pointsOf(HEATER), "point on the heater");
        const { rows: ids } = await client.query<{ id: string }>(
          "select id from public.checklist_items where boat_id = $1 and external_ref = $2",
          [BOAT, point.external_ref],
        );
        const pointId = first(ids, "checklist item").id;
        await client.query(
          `insert into public.checklist_completions (checklist_item_id, boat_id, completed_at, completed_by)
           values ($1, $2, current_date, $3)`,
          [pointId, BOAT, OWNER],
        );

        // Purged for real, as the trash job eventually does.
        await client.query("delete from public.equipment where id = $1", [HEATER]);

        const { rows: after } = await client.query<{ n: number; equipment_id: string | null }>(
          `select (select count(*)::int from public.checklist_completions where checklist_item_id = $1) as n,
                  (select equipment_id from public.checklist_items where id = $1) as equipment_id`,
          [pointId],
        );
        const survivor = first(after, "row");
        expect(Number(survivor.n), "the completion survives").toBe(1);
        expect(survivor.equipment_id, "the point is detached, not deleted").toBeNull();
      });
    });
  });

  describe("who may recompose a plan", () => {
    async function asUser<T>(sub: string, fn: () => Promise<T>): Promise<T> {
      await client.query("begin");
      try {
        await client.query("set local role authenticated");
        await client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub, email: `${sub}@test.xaman`, role: "authenticated" }),
        ]);
        return await fn();
      } finally {
        await client.query("rollback");
      }
    }

    it("lets someone who may write the boat, and refuses everyone else", async () => {
      await expect(
        asUser(OWNER, () => client.query("select public.apply_maintenance_rules($1)", [BOAT])),
      ).resolves.toBeDefined();

      // A viewer reads the boat but writes nothing.
      await expect(
        asUser("00000000-0000-0000-0000-000000000014", () =>
          client.query("select public.apply_maintenance_rules($1)", [BOAT]),
        ),
      ).rejects.toThrow(/forbidden/);

      // A stranger does not even see it.
      await expect(
        asUser("00000000-0000-0000-0000-000000000015", () =>
          client.query("select public.apply_maintenance_rules($1)", [BOAT]),
        ),
      ).rejects.toThrow(/forbidden/);
    });

    /** The unchecked body is the trigger's alone: nobody may call it directly. */
    it("keeps the unchecked composition out of reach", async () => {
      await expect(
        asUser(OWNER, () => client.query("select public.compose_maintenance_rules($1)", [BOAT])),
      ).rejects.toThrow(/permission denied/i);
    });
  });
});

/**
 * The SQL twin and the TypeScript one have to answer the same thing (rule 8's pattern): a rule
 * narrowed to « Wallas » is matched in Postgres, and the same brand is matched in the browser by
 * `matchEquipmentKind`. Two normalisers that drift would put a rule on the wrong boat.
 */
describeWithDb("normalise_for_match is the twin of normaliseForMatch", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  const SAMPLES = [
    "Wallas",
    "WALLAS 30DT",
    "Chauffage Wallas 30DT, air pulsé",
    "  Mât  carbone  ",
    "Pack B&G",
    "Eberspächer",
    "Aqua Base",
    "Dérive bâbord — n° 2",
    "ÀÉÎÕÜÇ",
    // The ligatures (E17-12). They are the drift the two accent tables were heading for: SQL went
    // through a table of its own that had never heard of `œ`, and TypeScript folds with NFD, which
    // does not decompose a letter that is not an accented one. Both said `c ur` for « Cœur ».
    "Cœur",
    "Sœur",
    "Ærø",
    "Nœud de chaise",
    "",
  ];

  it("answers the same on both sides", async () => {
    // The input comes back next to its answer, so the two sides are compared row by row rather
    // than by an index nobody can check.
    const { rows } = await client.query<{ source: string; sql: string }>(
      "select v as source, public.normalise_for_match(v) as sql from unnest($1::text[]) as t(v)",
      [SAMPLES],
    );
    expect(rows).toHaveLength(SAMPLES.length);
    for (const row of rows) {
      expect(row.sql, JSON.stringify(row.source)).toBe(normaliseForMatch(row.source));
    }
  });

  /**
   * Agreeing is not enough — the two sides agreed on `c ur` for « Cœur » until E17-12, which is
   * how the drift stayed invisible. So the SQL side is pinned to the answer itself, and the
   * TypeScript side to the same one in `equipment-kinds.test.ts`.
   */
  it("folds the ligatures rather than dropping them", async () => {
    const { rows } = await client.query<{ sql: string }>(
      "select public.normalise_for_match('Cœur de Sœur — Ærø') as sql",
    );
    expect(first(rows, "row").sql).toBe("coeur de soeur aero");
  });

  /** Which is to say: it is `text_fold` and a punctuation step, nothing of its own. */
  it("is text_fold with the punctuation turned into spaces", async () => {
    const { rows } = await client.query<{ same: boolean }>(
      `select bool_and(
                public.normalise_for_match(v)
                = trim(regexp_replace(public.text_fold(v), '[^a-z0-9&]+', ' ', 'g'))
              ) as same
       from unnest($1::text[]) as t(v)`,
      [SAMPLES],
    );
    expect(first(rows, "row").same).toBe(true);
  });
});
