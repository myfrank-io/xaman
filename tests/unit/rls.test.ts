/**
 * RLS matrix tests (SPEC.md §4.3, DATA-MODEL.md §5, BACKLOG E1-6).
 *
 * Runs against a Postgres that has the migrations + supabase/seed.sql applied
 * (`supabase start && supabase db reset`, or the shim in tests/support for a vanilla Postgres).
 * Every case runs inside a transaction that is rolled back, impersonating a user exactly like
 * PostgREST does: `set local role authenticated` + `request.jwt.claims`.
 */
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

type User = { id: string; email: string };

const U = {
  admin: { id: "00000000-0000-0000-0000-000000000010", email: "admin@test.xaman" },
  owner: { id: "00000000-0000-0000-0000-000000000011", email: "owner@test.xaman" },
  editor: { id: "00000000-0000-0000-0000-000000000012", email: "editor@test.xaman" },
  pro: { id: "00000000-0000-0000-0000-000000000013", email: "pro@test.xaman" },
  viewer: { id: "00000000-0000-0000-0000-000000000014", email: "viewer@test.xaman" },
  stranger: { id: "00000000-0000-0000-0000-000000000015", email: "stranger@test.xaman" },
} satisfies Record<string, User>;
type Role = keyof typeof U;

const BOAT = "00000000-0000-0000-0000-00000000b001";
const BOAT2 = "00000000-0000-0000-0000-00000000b002";
const CATEGORY = "00000000-0000-0000-0000-00000000ca01";
const ENGINE = "00000000-0000-0000-0000-00000000e001";
const ITEM = "00000000-0000-0000-0000-000000003001";
const LOG_OWNER = "00000000-0000-0000-0000-000000002001";
const LOG_PRO = "00000000-0000-0000-0000-000000002002";
const INVITATION_TOKEN = "test-token-secret-000000000000000000000000001";

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

async function as<T>(user: User | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (user) {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" }),
      ]);
    } else {
      await client.query("set local role anon");
    }
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

type Outcome = { ok: true; rowCount: number } | { ok: false; code: string; message: string };

async function run(user: User | null, sql: string, params: unknown[] = []): Promise<Outcome> {
  return as(user, async (c) => {
    try {
      const res = await c.query(sql, params);
      return { ok: true, rowCount: res.rowCount ?? 0 };
    } catch (e) {
      const err = e as { code?: string; message: string };
      return { ok: false, code: err.code ?? "", message: err.message };
    }
  });
}

async function count(user: User | null, table: string, where = "true", params: unknown[] = []) {
  const out = await as(user, async (c) => {
    try {
      const res = await c.query(
        `select count(*)::int as n from public.${table} where ${where}`,
        params,
      );
      return Number(res.rows[0]?.n ?? 0);
    } catch {
      return -1; // permission denied (e.g. anon)
    }
  });
  return out;
}

const BUSINESS_TABLES = [
  "engines",
  "boat_categories",
  "equipment",
  "contacts",
  "haul_outs",
  "maintenance_logs",
  "checklist_items",
  "checklist_completions",
  "engine_hour_readings",
  "parts",
  "purchases",
  "attachments",
] as const;

const WRITE_ONLY_TABLES = [
  "engines",
  "boat_categories",
  "equipment",
  "contacts",
  "haul_outs",
  "parts",
  "purchases",
  "checklist_items",
] as const;

beforeAll(async () => {
  try {
    await pool.query("select 1");
  } catch (e) {
    throw new Error(
      `RLS tests need a database at DATABASE_URL (${DATABASE_URL}). Run \`supabase start && supabase db reset\` first. ${String(e)}`,
    );
  }
});

afterAll(async () => {
  await pool.end();
});

describe("read access (select)", () => {
  it.each(BUSINESS_TABLES)(
    "members of every role see %s of their boat, outsiders see nothing",
    async (table) => {
      for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
        expect(
          await count(U[role], table, "boat_id = $1", [BOAT]),
          `${role} on ${table}`,
        ).toBeGreaterThan(0);
      }
      expect(await count(U.stranger, table, "boat_id = $1", [BOAT])).toBe(0);
      expect(await count(null, table)).toBe(-1);
    },
  );

  it("boats: members and admin see the boat; outsiders do not; tenant isolation holds", async () => {
    for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
      expect(await count(U[role], "boats", "id = $1", [BOAT]), role).toBe(1);
    }
    expect(await count(U.stranger, "boats", "id = $1", [BOAT])).toBe(0);
    expect(await count(U.owner, "boats", "id = $1", [BOAT2])).toBe(0);
    expect(await count(U.owner, "maintenance_logs", "boat_id = $1", [BOAT2])).toBe(0);
    expect(await count(U.stranger, "boats", "id = $1", [BOAT2])).toBe(1);
  });

  it("boat_members: owner/editor/admin see the list, pro/viewer only their own row", async () => {
    expect(await count(U.owner, "boat_members", "boat_id = $1", [BOAT])).toBe(4);
    expect(await count(U.editor, "boat_members", "boat_id = $1", [BOAT])).toBe(4);
    expect(await count(U.admin, "boat_members", "boat_id = $1", [BOAT])).toBe(4);
    expect(await count(U.pro, "boat_members", "boat_id = $1", [BOAT])).toBe(1);
    expect(await count(U.viewer, "boat_members", "boat_id = $1", [BOAT])).toBe(1);
    expect(await count(U.stranger, "boat_members", "boat_id = $1", [BOAT])).toBe(0);
  });

  it("boat_invitations: only owners (and admin) see them; the token column is unreadable for everyone", async () => {
    expect(await count(U.owner, "boat_invitations", "boat_id = $1", [BOAT])).toBe(1);
    expect(await count(U.admin, "boat_invitations", "boat_id = $1", [BOAT])).toBe(1);
    for (const role of ["editor", "pro", "viewer", "stranger"] as Role[]) {
      expect(await count(U[role], "boat_invitations", "boat_id = $1", [BOAT]), role).toBe(0);
    }
    const owner = await run(U.owner, "select token from public.boat_invitations");
    expect(owner.ok).toBe(false);
    if (!owner.ok) expect(owner.code).toBe("42501");
    const star = await run(U.owner, "select * from public.boat_invitations");
    expect(star.ok).toBe(false);
  });

  it("profiles: a user sees themself and the people sharing a boat; the admin sees everyone", async () => {
    expect(await count(U.owner, "profiles")).toBe(4);
    expect(await count(U.pro, "profiles")).toBe(4);
    expect(await count(U.stranger, "profiles")).toBe(1);
    expect(await count(U.admin, "profiles")).toBe(6);
  });

  // A count, not a fixed number: the registry grows every time a model is published (0016 added
  // the three generic ones), and what has to hold is that every public model is readable by
  // anyone signed in and by nobody who is not.
  it("checklist templates are readable by any signed-in user", async () => {
    const published = await as(U.admin, async (c) => {
      const res = await c.query(
        "select count(*)::int as n from public.checklist_templates where is_public",
      );
      return Number((res.rows[0] as { n: number }).n);
    });
    expect(published).toBeGreaterThan(1);
    expect(await count(U.stranger, "checklist_templates")).toBe(published);
    expect(await count(U.viewer, "checklist_template_items")).toBeGreaterThan(0);
    expect(await count(null, "checklist_templates")).toBe(-1);
  });

  it("boat_role() reflects membership; the platform admin is a virtual owner", async () => {
    const roleOf = async (u: User) =>
      as(u, async (c) => {
        const res = await c.query("select public.boat_role($1::uuid) as role", [BOAT]);
        return res.rows[0]?.role as string | null;
      });
    expect(await roleOf(U.owner)).toBe("owner");
    expect(await roleOf(U.editor)).toBe("editor");
    expect(await roleOf(U.pro)).toBe("pro");
    expect(await roleOf(U.viewer)).toBe("viewer");
    expect(await roleOf(U.admin)).toBe("owner");
    expect(await roleOf(U.stranger)).toBeNull();
  });
});

describe("insert", () => {
  const insertLog = (u: User, createdBy: string) =>
    run(
      u,
      "insert into public.maintenance_logs (boat_id, title, category_id, performed_at, created_by) values ($1, 'Test', $2, '2026-06-01', $3)",
      [BOAT, CATEGORY, createdBy],
    );

  it("maintenance_logs: owner, editor and pro (own row) may insert; viewer and outsiders may not", async () => {
    expect((await insertLog(U.owner, U.owner.id)).ok).toBe(true);
    expect((await insertLog(U.editor, U.editor.id)).ok).toBe(true);
    expect((await insertLog(U.pro, U.pro.id)).ok).toBe(true);
    expect((await insertLog(U.pro, U.owner.id)).ok).toBe(false);
    expect((await insertLog(U.viewer, U.viewer.id)).ok).toBe(false);
    expect((await insertLog(U.stranger, U.stranger.id)).ok).toBe(false);
    expect((await insertLog(U.admin, U.admin.id)).ok).toBe(true);
  });

  it("checklist_completions / engine_hour_readings / attachments: contribute rules", async () => {
    const completion = (u: User, by: string) =>
      run(
        u,
        "insert into public.checklist_completions (boat_id, checklist_item_id, completed_at, engine_hours, created_by) values ($1, $2, '2026-06-01', 700, $3)",
        [BOAT, ITEM, by],
      );
    const reading = (u: User, by: string) =>
      run(
        u,
        "insert into public.engine_hour_readings (boat_id, engine_id, hours, read_at, created_by) values ($1, $2, 710, '2026-06-02', $3)",
        [BOAT, ENGINE, by],
      );
    const attachment = (u: User, by: string) =>
      run(
        u,
        "insert into public.attachments (boat_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes, created_by) values ($1, 'boat', $1, $2, 'p.jpg', 'image/jpeg', 10, $3)",
        [BOAT, `boats/${BOAT}/boat/${BOAT}/p.jpg`, by],
      );
    for (const fn of [completion, reading, attachment]) {
      expect((await fn(U.owner, U.owner.id)).ok, fn.name).toBe(true);
      expect((await fn(U.editor, U.editor.id)).ok, fn.name).toBe(true);
      expect((await fn(U.pro, U.pro.id)).ok, fn.name).toBe(true);
      expect((await fn(U.pro, U.owner.id)).ok, fn.name).toBe(false);
      expect((await fn(U.viewer, U.viewer.id)).ok, fn.name).toBe(false);
      expect((await fn(U.stranger, U.stranger.id)).ok, fn.name).toBe(false);
    }
  });

  it.each(WRITE_ONLY_TABLES)("%s: only owner/editor (and admin) may insert", async (table) => {
    const sqlByTable: Record<(typeof WRITE_ONLY_TABLES)[number], string> = {
      engines:
        "insert into public.engines (boat_id, label, position, created_by) values ($1, 'E', 'port', $2)",
      boat_categories:
        "insert into public.boat_categories (boat_id, name, color, created_by) values ($1, 'Cat', '#123456', $2)",
      equipment: "insert into public.equipment (boat_id, name, created_by) values ($1, 'Eq', $2)",
      contacts:
        "insert into public.contacts (boat_id, name, specialty, created_by) values ($1, 'C', 'Autre', $2)",
      haul_outs:
        "insert into public.haul_outs (boat_id, started_at, created_by) values ($1, '2026-06-01', $2)",
      parts: "insert into public.parts (boat_id, name, created_by) values ($1, 'P', $2)",
      purchases:
        "insert into public.purchases (boat_id, purchased_at, designation, created_by) values ($1, '2026-06-01', 'D', $2)",
      checklist_items:
        "insert into public.checklist_items (boat_id, category_id, label, created_by) values ($1, $3, 'Point', $2)",
    };
    const sql = sqlByTable[table];
    const params = (u: User) =>
      table === "checklist_items" ? [BOAT, u.id, CATEGORY] : [BOAT, u.id];
    expect((await run(U.owner, sql, params(U.owner))).ok, "owner").toBe(true);
    expect((await run(U.editor, sql, params(U.editor))).ok, "editor").toBe(true);
    expect((await run(U.admin, sql, params(U.admin))).ok, "admin").toBe(true);
    expect((await run(U.pro, sql, params(U.pro))).ok, "pro").toBe(false);
    expect((await run(U.viewer, sql, params(U.viewer))).ok, "viewer").toBe(false);
    expect((await run(U.stranger, sql, params(U.stranger))).ok, "stranger").toBe(false);
  });

  // D64: the table stays shut. Opening a carnet goes through create_boat, so a boat can never
  // exist without an owner and never exist without its checklist.
  it("boats: the table itself still takes an insert only from the platform admin", async () => {
    const sql = "insert into public.boats (name, type, created_by) values ('Nouveau', 'motor', $1)";
    expect((await run(U.admin, sql, [U.admin.id])).ok).toBe(true);
    expect((await run(U.owner, sql, [U.owner.id])).ok).toBe(false);
    expect((await run(U.viewer, sql, [U.viewer.id])).ok).toBe(false);
  });

  it("boat_members and boat_invitations: owner only", async () => {
    const member =
      "insert into public.boat_members (boat_id, user_id, role) values ($1, $2, 'viewer')";
    expect((await run(U.owner, member, [BOAT, U.stranger.id])).ok).toBe(true);
    expect((await run(U.admin, member, [BOAT, U.stranger.id])).ok).toBe(true);
    expect((await run(U.editor, member, [BOAT, U.stranger.id])).ok).toBe(false);
    const invite =
      "insert into public.boat_invitations (boat_id, email, role, token, invited_by) values ($1, 'new@test.xaman', 'editor', $2, $3)";
    expect((await run(U.owner, invite, [BOAT, "tok-1", U.owner.id])).ok).toBe(true);
    expect((await run(U.owner, invite, [BOAT, "tok-2", U.editor.id])).ok).toBe(false);
    expect((await run(U.editor, invite, [BOAT, "tok-3", U.editor.id])).ok).toBe(false);
  });

  it("checklist templates: platform admin only", async () => {
    const sql = "insert into public.checklist_templates (name, external_ref) values ('T', $1)";
    expect((await run(U.admin, sql, ["t-admin"])).ok).toBe(true);
    expect((await run(U.owner, sql, ["t-owner"])).ok).toBe(false);
  });

  // D69, migration 0019. A published catalogue: it holds nobody's data, so it carries no boat_id
  // and everyone signed in reads it — but only the platform admin decides what it contains.
  it("boat models: written by the platform admin only", async () => {
    const sql =
      "insert into public.boat_models (external_ref, builder, model, boat_type) values ($1, 'Chantier', 'M', 'motor')";
    expect((await run(U.admin, sql, ["bm-admin"])).ok, "admin").toBe(true);
    expect((await run(U.owner, sql, ["bm-owner"])).ok, "owner").toBe(false);
    expect((await run(U.viewer, sql, ["bm-viewer"])).ok, "viewer").toBe(false);
    expect((await run(U.stranger, sql, ["bm-stranger"])).ok, "stranger").toBe(false);
    expect(await count(null, "boat_models")).toBe(-1);
  });

  /**
   * Read side, in one transaction so the rows written here are the rows read back: an active model
   * is the same catalogue for everyone signed in, and a model retired from seed/boat-models.json
   * — deactivated by the data migration, never deleted — stops being suggested. The query in
   * `src/lib/queries/boat-models.ts` knows nothing about `is_active`; this policy is what hides it.
   */
  it("boat models: active rows are public, deactivated ones are the admin's alone", async () => {
    const seen = await as(U.admin, async (c) => {
      await c.query(
        `insert into public.boat_models (external_ref, builder, model, boat_type, is_active) values
           ('bm-live', 'Chantier', 'Publié', 'motor', true),
           ('bm-retired', 'Chantier', 'Retiré', 'motor', false)`,
      );
      const refs = async () => {
        const res = await c.query(
          "select external_ref from public.boat_models where external_ref like 'bm-%' order by external_ref",
        );
        return res.rows.map((r) => (r as { external_ref: string }).external_ref);
      };
      const admin = await refs();
      // Same transaction, another identity — exactly what PostgREST does per request.
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: U.stranger.id, email: U.stranger.email, role: "authenticated" }),
      ]);
      return { admin, stranger: await refs() };
    });

    expect(seen.admin).toEqual(["bm-live", "bm-retired"]);
    expect(seen.stranger).toEqual(["bm-live"]);
  });
});

/**
 * Opening a carnet (D65, migrations 0015 + 0017). `create_boat` is the only door an ordinary user
 * has to a boat of their own, so what it refuses matters as much as what it creates — and since
 * D65 what it deliberately does NOT create matters too.
 */
describe("create_boat", () => {
  const NEW_BOAT = "00000000-0000-0000-0000-00000000b0f1";
  const ORC50 = "00000000-0000-0000-0000-0000000000a0";

  const call = (boatId: string, name = "Mon bateau", type = "catamaran", engines = "[]") =>
    `select public.create_boat('${boatId}'::uuid, '${name}', '${type}'::public.boat_type, null, null, '${engines}'::jsonb)`;

  it("makes the caller the owner, with the boat's own identity and its systems", async () => {
    const out = await as(U.stranger, async (c) => {
      await c.query(
        "select public.create_boat($1::uuid, $2, $3::public.boat_type, $4, $5, $6::jsonb)",
        [
          NEW_BOAT,
          "  Alizé  ",
          "trimaran",
          "  Neel  ",
          " 47 ",
          JSON.stringify([
            { label: "Moteur bâbord", position: "port" },
            { label: "Moteur tribord", position: "starboard" },
          ]),
        ],
      );
      const boat = await c.query(
        "select name, type, builder, model, checklist_template_id from public.boats where id = $1",
        [NEW_BOAT],
      );
      const role = await c.query("select public.boat_role($1::uuid) as role", [NEW_BOAT]);
      const counts = await c.query(
        `select
           (select count(*)::int from public.engines where boat_id = $1) as engines,
           (select count(*)::int from public.boat_categories where boat_id = $1) as categories,
           (select count(*)::int from public.checklist_items where boat_id = $1) as items`,
        [NEW_BOAT],
      );
      const row = boat.rows[0] as {
        name: string;
        type: string;
        builder: string | null;
        model: string | null;
        checklist_template_id: string | null;
      };
      const n = counts.rows[0] as { engines: number; categories: number; items: number };
      return {
        name: row.name,
        // A trimaran stays a trimaran: the hull is no longer inherited from a chosen model.
        type: row.type,
        builder: row.builder,
        model: row.model,
        plan: row.checklist_template_id,
        role: (role.rows[0] as { role: string | null }).role,
        engines: Number(n.engines),
        categories: Number(n.categories),
        items: Number(n.items),
      };
    });

    expect(out.name).toBe("Alizé");
    expect(out.type).toBe("trimaran");
    // Free text: a builder we publish nothing for is still written down exactly.
    expect(out.builder).toBe("Neel");
    expect(out.model).toBe("47");
    expect(out.role).toBe("owner");
    expect(out.engines).toBe(2);
    // The systems arrive, so the boat is usable; the maintenance plan does not (D65).
    expect(out.categories).toBe(8);
    expect(out.items).toBe(0);
    expect(out.plan).toBeNull();
  });

  /**
   * The whole point of the split: choosing a plan afterwards must fill the systems the boat
   * already has, never duplicate them, and never undo a rename made in between.
   */
  it("a plan chosen later merges into the existing systems", async () => {
    const out = await as(U.stranger, async (c) => {
      await c.query(
        call(
          NEW_BOAT,
          "Alizé",
          "catamaran",
          JSON.stringify([
            { label: "Moteur bâbord", position: "port" },
            { label: "Moteur tribord", position: "starboard" },
          ]),
        ),
      );
      await c.query(
        "update public.boat_categories set name = 'Propulsion' where boat_id = $1 and external_ref = 'engines'",
        [NEW_BOAT],
      );
      const template = await c.query(
        "select id from public.checklist_templates where external_ref = 'generic-catamaran-v1'",
      );
      await c.query("select public.apply_checklist_template($1::uuid, $2::uuid)", [
        NEW_BOAT,
        (template.rows[0] as { id: string }).id,
      ]);
      const res = await c.query(
        `select
           (select count(*)::int from public.boat_categories where boat_id = $1) as categories,
           (select count(*)::int from public.checklist_items where boat_id = $1) as items,
           (select count(*)::int from public.boat_categories where boat_id = $1 and template_category_id is null) as unlinked,
           (select name from public.boat_categories where boat_id = $1 and external_ref = 'engines') as renamed,
           (select checklist_template_id from public.boats where id = $1) as plan`,
        [NEW_BOAT],
      );
      return res.rows[0] as {
        categories: number;
        items: number;
        unlinked: number;
        renamed: string;
        plan: string | null;
      };
    });

    expect(Number(out.categories)).toBe(8);
    expect(Number(out.unlinked)).toBe(0);
    expect(out.renamed).toBe("Propulsion");
    expect(out.plan).not.toBeNull();
    // 70 template points, 10 of them engine-scoped: 9 inboard × 2 engines, 1 outboard skipped.
    expect(Number(out.items)).toBe(78);
  });

  /**
   * D69. Tapping « Lagoon 42 » in the suggestions is worth more than the two words it types: the
   * catalogue already knows the hull's dimensions, and the boat opens carrying them.
   *
   * The client sends the row's id, never the measurements — so what is stored is what the
   * catalogue says, and an id naming nothing (or naming a retired row) is ignored rather than
   * fatal: a boat must open whatever happens to the catalogue.
   */
  it("copies the dimensions of the model that was tapped, and only those", async () => {
    const LIVE = "00000000-0000-0000-0000-0000000000c1";
    const RETIRED = "00000000-0000-0000-0000-0000000000c2";
    const UNKNOWN = "00000000-0000-0000-0000-0000000000c9";

    const out = await as(U.admin, async (c) => {
      await c.query(
        `insert into public.boat_models (id, external_ref, builder, model, boat_type, length_m, beam_m, draft_m, is_active) values
           ($1, 'bm-lagoon-42', 'Lagoon', 'Lagoon 42', 'catamaran', 12.80, 7.70, 1.25, true),
           ($2, 'bm-gone', 'Chantier', 'Retiré', 'catamaran', 9.99, 4.44, 1.11, false)`,
        [LIVE, RETIRED],
      );
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: U.stranger.id, email: U.stranger.email, role: "authenticated" }),
      ]);

      const open = async (boatId: string, modelId: string | null) => {
        await c.query(
          "select public.create_boat($1::uuid, $2, 'catamaran'::public.boat_type, $3, $4, '[]'::jsonb, $5::uuid)",
          [boatId, "Bateau", "Écrit à la main", "42 à moi", modelId],
        );
        const res = await c.query(
          "select builder, model, length_m, beam_m, draft_m from public.boats where id = $1",
          [boatId],
        );
        return res.rows[0] as {
          builder: string;
          model: string;
          length_m: string | null;
          beam_m: string | null;
          draft_m: string | null;
        };
      };

      return {
        tapped: await open("00000000-0000-0000-0000-00000000b0f2", LIVE),
        retired: await open("00000000-0000-0000-0000-00000000b0f3", RETIRED),
        unknown: await open("00000000-0000-0000-0000-00000000b0f4", UNKNOWN),
        typed: await open("00000000-0000-0000-0000-00000000b0f5", null),
      };
    });

    expect(Number(out.tapped.length_m)).toBe(12.8);
    expect(Number(out.tapped.beam_m)).toBe(7.7);
    expect(Number(out.tapped.draft_m)).toBe(1.25);
    // The visible fields stay what the form shows: the catalogue never overwrites an edit.
    expect(out.tapped.builder).toBe("Écrit à la main");
    expect(out.tapped.model).toBe("42 à moi");

    for (const boat of [out.retired, out.unknown, out.typed]) {
      expect(boat.length_m).toBeNull();
      expect(boat.beam_m).toBeNull();
      expect(boat.draft_m).toBeNull();
    }
  });

  // Rule 11 / D18: the form draws the id when it opens, so the second tap of a double tap is
  // this exact call again — and must not open a second carnet.
  it("is idempotent: a replay returns the same boat instead of a twin", async () => {
    const count = await as(U.stranger, async (c) => {
      await c.query(call(NEW_BOAT));
      await c.query(call(NEW_BOAT));
      const res = await c.query("select count(*)::int as n from public.boats where id = $1", [
        NEW_BOAT,
      ]);
      return Number((res.rows[0] as { n: number }).n);
    });
    expect(count).toBe(1);
  });

  it("refuses a boat id that already belongs to someone else", async () => {
    const res = await run(U.viewer, call(BOAT2));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("forbidden");
  });

  it("refuses a blank name and a malformed engine", async () => {
    const blank = await run(U.viewer, call(NEW_BOAT, "   "));
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.message).toContain("invalid_name");

    const badPosition = await run(
      U.viewer,
      call(NEW_BOAT, "X", "catamaran", '[{"label":"M","position":"milieu"}]'),
    );
    expect(badPosition.ok).toBe(false);
    if (!badPosition.ok) expect(badPosition.message).toContain("invalid_engine");
  });

  it("is closed to anon", async () => {
    const res = await run(null, call(NEW_BOAT));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("42501");
  });

  // A boat is unusable without categories: a category is compulsory on an intervention and
  // `checklist_items.category_id` is `on delete restrict`. Every hull must map to a model.
  it("gives every hull type its systems", async () => {
    for (const type of ["catamaran", "trimaran", "monohull_sail", "motor", "rib", "other"]) {
      const categories = await as(U.stranger, async (c) => {
        await c.query(call(NEW_BOAT, "X", type));
        const res = await c.query(
          "select count(*)::int as n from public.boat_categories where boat_id = $1",
          [NEW_BOAT],
        );
        return Number((res.rows[0] as { n: number }).n);
      });
      expect(categories, type).toBeGreaterThanOrEqual(7);
    }
  });

  it("apply_template_categories is refused to someone who cannot write the boat", async () => {
    const res = await run(
      U.viewer,
      `select public.apply_template_categories('${BOAT}'::uuid, '${ORC50}'::uuid)`,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("forbidden");
  });

  // The registry the plan picker reads. security_invoker, so it must show exactly what
  // checklist_templates_select allows and never leak a private model.
  it("checklist_template_catalog: public models for everyone, private ones for the admin only", async () => {
    const visible = (user: User) =>
      as(user, async (c) => {
        const res = await c.query(
          "select count(*)::int as n from public.checklist_template_catalog where id = $1",
          [ORC50],
        );
        return Number((res.rows[0] as { n: number }).n);
      });
    expect(await visible(U.viewer)).toBe(1);
    expect(await visible(U.stranger)).toBe(1);

    const hidden = await as(U.viewer, async (c) => {
      await c.query("set local role service_role");
      await c.query("update public.checklist_templates set is_public = false where id = $1", [
        ORC50,
      ]);
      await c.query("set local role authenticated");
      const mine = await c.query(
        "select count(*)::int as n from public.checklist_template_catalog where id = $1",
        [ORC50],
      );
      return Number((mine.rows[0] as { n: number }).n);
    });
    expect(hidden).toBe(0);
  });

  it("counts the boats a person already owns, so the cap has something to count", async () => {
    const owned = await as(U.stranger, async (c) => {
      const res = await c.query(
        "select count(*)::int as n from public.boat_members where user_id = $1 and role = 'owner'",
        [U.stranger.id],
      );
      return Number((res.rows[0] as { n: number }).n);
    });
    expect(owned).toBe(1);
  });
});

describe("update", () => {
  it("maintenance_logs: owner/editor edit everything; a pro edits only their own rows", async () => {
    const setTitle = (u: User, id: string) =>
      run(u, "update public.maintenance_logs set title = 'Modifié' where id = $1", [id]);
    expect(
      (await setTitle(U.owner, LOG_PRO)).ok &&
        ((await setTitle(U.owner, LOG_PRO)) as { rowCount: number }).rowCount,
    ).toBe(1);
    expect(await setTitle(U.editor, LOG_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await setTitle(U.pro, LOG_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await setTitle(U.pro, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
    expect(await setTitle(U.viewer, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
    expect(await setTitle(U.stranger, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
  });

  it("maintenance_logs: a pro cannot move even their own row to the trash; owner/editor can", async () => {
    const trash = (u: User, id: string) =>
      run(u, "update public.maintenance_logs set deleted_at = now() where id = $1", [id]);
    const pro = await trash(U.pro, LOG_PRO);
    expect(pro.ok).toBe(false);
    if (!pro.ok) expect(pro.code).toBe("42501");
    expect(await trash(U.owner, LOG_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await trash(U.editor, LOG_OWNER)).toEqual({ ok: true, rowCount: 1 });
    expect(await trash(U.viewer, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
  });

  it("a pro cannot hand their row over to someone else or to another boat", async () => {
    expect(
      (
        await run(U.pro, "update public.maintenance_logs set created_by = $2 where id = $1", [
          LOG_PRO,
          U.owner.id,
        ])
      ).ok,
    ).toBe(false);
    expect(
      (
        await run(U.pro, "update public.maintenance_logs set boat_id = $2 where id = $1", [
          LOG_PRO,
          BOAT2,
        ])
      ).ok,
    ).toBe(false);
  });

  it("boats: owner/editor update the boat, pro/viewer cannot", async () => {
    const sql = "update public.boats set notes = 'n' where id = $1";
    expect(await run(U.owner, sql, [BOAT])).toEqual({ ok: true, rowCount: 1 });
    expect(await run(U.editor, sql, [BOAT])).toEqual({ ok: true, rowCount: 1 });
    expect(await run(U.pro, sql, [BOAT])).toEqual({ ok: true, rowCount: 0 });
    expect(await run(U.viewer, sql, [BOAT])).toEqual({ ok: true, rowCount: 0 });
  });

  it("boat_members: only owners change roles, and the last owner is protected", async () => {
    const demote = (u: User, userId: string) =>
      run(u, "update public.boat_members set role = 'viewer' where boat_id = $1 and user_id = $2", [
        BOAT,
        userId,
      ]);
    expect(await demote(U.owner, U.editor.id)).toEqual({ ok: true, rowCount: 1 });
    expect(await demote(U.editor, U.viewer.id)).toEqual({ ok: true, rowCount: 0 });
    const last = await demote(U.owner, U.owner.id);
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.message).toContain("last_owner");
    const remove = await run(
      U.owner,
      "delete from public.boat_members where boat_id = $1 and user_id = $2",
      [BOAT, U.owner.id],
    );
    expect(remove.ok).toBe(false);
    // promoting a second owner first makes the demotion legal
    const twoOwners = await as(U.owner, async (c) => {
      await c.query(
        "update public.boat_members set role = 'owner' where boat_id = $1 and user_id = $2",
        [BOAT, U.editor.id],
      );
      const res = await c.query(
        "update public.boat_members set role = 'editor' where boat_id = $1 and user_id = $2",
        [BOAT, U.owner.id],
      );
      return res.rowCount;
    });
    expect(twoOwners).toBe(1);
  });

  it("boat_invitations: owner revokes; nothing else is updatable", async () => {
    expect(
      await run(
        U.owner,
        "update public.boat_invitations set revoked_at = now() where boat_id = $1",
        [BOAT],
      ),
    ).toEqual({ ok: true, rowCount: 1 });
    expect(
      (
        await run(
          U.owner,
          "update public.boat_invitations set email = 'x@test.xaman' where boat_id = $1",
          [BOAT],
        )
      ).ok,
    ).toBe(false);
    expect(
      await run(
        U.editor,
        "update public.boat_invitations set revoked_at = now() where boat_id = $1",
        [BOAT],
      ),
    ).toEqual({ ok: true, rowCount: 0 });
  });

  it("profiles: a user edits their own display data only, never is_platform_admin", async () => {
    expect(
      await run(U.owner, "update public.profiles set full_name = 'O' where id = $1", [U.owner.id]),
    ).toEqual({ ok: true, rowCount: 1 });
    expect(
      await run(U.owner, "update public.profiles set full_name = 'E' where id = $1", [U.editor.id]),
    ).toEqual({ ok: true, rowCount: 0 });
    const admin = await run(
      U.owner,
      "update public.profiles set is_platform_admin = true where id = $1",
      [U.owner.id],
    );
    expect(admin.ok).toBe(false);
    const email = await run(
      U.owner,
      "update public.profiles set email = 'x@test.xaman' where id = $1",
      [U.owner.id],
    );
    expect(email.ok).toBe(false);
  });
});

describe("delete", () => {
  it("maintenance_logs: owner/editor may delete, pro and viewer may not (even their own rows)", async () => {
    const del = (u: User, id: string) =>
      run(u, "delete from public.maintenance_logs where id = $1", [id]);
    expect(await del(U.owner, LOG_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await del(U.editor, LOG_OWNER)).toEqual({ ok: true, rowCount: 1 });
    expect(await del(U.pro, LOG_PRO)).toEqual({ ok: true, rowCount: 0 });
    expect(await del(U.viewer, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
  });

  it("boats: only the owner deletes the boat (cascade), editors cannot", async () => {
    expect(await run(U.editor, "delete from public.boats where id = $1", [BOAT])).toEqual({
      ok: true,
      rowCount: 0,
    });
    expect(await run(U.owner, "delete from public.boats where id = $1", [BOAT])).toEqual({
      ok: true,
      rowCount: 1,
    });
  });

  it("boat_members: the owner removes a member; a member cannot remove others", async () => {
    expect(
      await run(U.owner, "delete from public.boat_members where boat_id = $1 and user_id = $2", [
        BOAT,
        U.viewer.id,
      ]),
    ).toEqual({ ok: true, rowCount: 1 });
    expect(
      await run(U.editor, "delete from public.boat_members where boat_id = $1 and user_id = $2", [
        BOAT,
        U.viewer.id,
      ]),
    ).toEqual({ ok: true, rowCount: 0 });
  });
});

describe("invitation functions", () => {
  it("get_invitation_preview works anonymously and exposes only the preview", async () => {
    const preview = await as(null, async (c) => {
      const res = await c.query("select * from public.get_invitation_preview($1)", [
        INVITATION_TOKEN,
      ]);
      return res.rows[0] as Record<string, unknown> | undefined;
    });
    // 0007: the address is masked on the public page; only the domain and the initial show.
    expect(preview).toMatchObject({
      boat_name: "Bateau test",
      email: "s•••@test.xaman",
      role: "viewer",
      status: "pending",
    });
    const unknown = await as(
      null,
      async (c) => (await c.query("select * from public.get_invitation_preview('nope')")).rowCount,
    );
    expect(unknown).toBe(0);
  });

  it("accept_invitation adds the member when the e-mail matches, and rejects everyone else", async () => {
    const accepted = await as(U.stranger, async (c) => {
      const res = await c.query("select public.accept_invitation($1) as boat_id", [
        INVITATION_TOKEN,
      ]);
      const visible = await c.query("select count(*)::int as n from public.boats where id = $1", [
        BOAT,
      ]);
      return { boatId: res.rows[0]?.boat_id as string, visible: Number(visible.rows[0]?.n) };
    });
    expect(accepted).toEqual({ boatId: BOAT, visible: 1 });

    const mismatch = await run(U.viewer, "select public.accept_invitation($1)", [INVITATION_TOKEN]);
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.message).toContain("invitation_email_mismatch");

    const anon = await run(null, "select public.accept_invitation($1)", [INVITATION_TOKEN]);
    expect(anon.ok).toBe(false);
  });
});

describe("storage bucket boat-files", () => {
  const OBJECT = `boats/${BOAT}/maintenance_log/${LOG_OWNER}/photo.jpg`;
  const insertObject = (u: User) =>
    run(u, "insert into storage.objects (bucket_id, name, owner) values ('boat-files', $1, $2)", [
      OBJECT,
      u.id,
    ]);

  it("contributors upload under their boat prefix; viewers and outsiders cannot", async () => {
    expect((await insertObject(U.owner)).ok).toBe(true);
    expect((await insertObject(U.pro)).ok).toBe(true);
    expect((await insertObject(U.viewer)).ok).toBe(false);
    expect((await insertObject(U.stranger)).ok).toBe(false);
    expect(
      (
        await run(
          U.owner,
          "insert into storage.objects (bucket_id, name) values ('boat-files', $1)",
          [`boats/${BOAT2}/x.jpg`],
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await run(
          U.owner,
          "insert into storage.objects (bucket_id, name) values ('boat-files', 'loose.jpg')",
        )
      ).ok,
    ).toBe(false);
  });

  it("members read objects of their boat; only owner/editor delete them", async () => {
    const seeded = await as(U.owner, async (c) => {
      await c.query(
        "insert into storage.objects (bucket_id, name, owner) values ('boat-files', $1, $2)",
        [OBJECT, U.owner.id],
      );
      return true;
    });
    expect(seeded).toBe(true);
    // each `as` call is its own rolled-back transaction: re-insert with the service role for reads
    const readAs = (u: User) =>
      as(u, async (c) => {
        await c.query("set local role service_role");
        await c.query("insert into storage.objects (bucket_id, name) values ('boat-files', $1)", [
          OBJECT,
        ]);
        await c.query("set local role authenticated");
        const res = await c.query(
          "select count(*)::int as n from storage.objects where name = $1",
          [OBJECT],
        );
        // Storage ≥ 1.x guards storage.objects against direct deletes (statement trigger
        // storage.protect_delete); the Storage API sets this GUC before deleting.
        await c.query("set local storage.allow_delete_query = 'true'");
        const del = await c.query("delete from storage.objects where name = $1", [OBJECT]);
        return { seen: Number(res.rows[0]?.n), deleted: del.rowCount };
      });
    expect(await readAs(U.viewer)).toEqual({ seen: 1, deleted: 0 });
    expect(await readAs(U.pro)).toEqual({ seen: 1, deleted: 0 });
    expect(await readAs(U.editor)).toEqual({ seen: 1, deleted: 1 });
    expect(await readAs(U.stranger)).toEqual({ seen: 0, deleted: 0 });
  });
});

// ---------------------------------------------------------------------------------------------
// Attachments (migration 0011_attachments.sql, E10-1)
// ---------------------------------------------------------------------------------------------
const ATT_OWNER = "00000000-0000-0000-0000-000000008001";
const ATT_PRO = "00000000-0000-0000-0000-000000008002";
const PURCHASE = "00000000-0000-0000-0000-000000007001";

describe("attachments (E10-1)", () => {
  const pathFor = (owner: string, entity: string, id: string, file: string) =>
    `boats/${owner}/${entity}/${id}/${file}`;

  const attach = (
    u: User,
    createdBy: string,
    opts: {
      boatId?: string;
      entity?: string;
      entityId?: string;
      path?: string;
      mime?: string;
      bytes?: number;
    } = {},
  ) => {
    const boat = opts.boatId ?? BOAT;
    const entity = opts.entity ?? "maintenance_log";
    const entityId = opts.entityId ?? LOG_OWNER;
    return run(
      u,
      `insert into public.attachments
         (boat_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes, created_by)
       values ($1, $2::public.attachment_entity, $3, $4, 'doc', $5, $6, $7)`,
      [
        boat,
        entity,
        entityId,
        opts.path ?? pathFor(boat, entity, entityId, `${crypto.randomUUID()}.jpg`),
        opts.mime ?? "image/jpeg",
        opts.bytes ?? 2048,
        createdBy,
      ],
    );
  };

  it("every member reads the documents of the boat; outsiders and anon read none", async () => {
    for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
      expect(await count(U[role], "attachments", "boat_id = $1", [BOAT]), role).toBe(2);
    }
    expect(await count(U.stranger, "attachments", "boat_id = $1", [BOAT])).toBe(0);
    expect(await count(null, "attachments")).toBe(-1);
  });

  it("insert: owner/editor anywhere, a pro only as themselves, viewer and outsiders never", async () => {
    expect((await attach(U.owner, U.owner.id)).ok, "owner").toBe(true);
    expect((await attach(U.editor, U.editor.id)).ok, "editor").toBe(true);
    expect((await attach(U.admin, U.admin.id)).ok, "admin").toBe(true);
    expect((await attach(U.pro, U.pro.id, { entityId: LOG_PRO })).ok, "pro on their row").toBe(
      true,
    );
    expect((await attach(U.pro, U.owner.id)).ok, "pro under another name").toBe(false);
    expect((await attach(U.viewer, U.viewer.id)).ok, "viewer").toBe(false);
    expect((await attach(U.stranger, U.stranger.id)).ok, "stranger").toBe(false);
    expect((await attach(U.owner, U.owner.id, { entity: "purchase", entityId: PURCHASE })).ok).toBe(
      true,
    );
  });

  it("the storage path must resolve to the row's own boat", async () => {
    const crossed = await attach(U.owner, U.owner.id, {
      path: pathFor(BOAT2, "maintenance_log", LOG_OWNER, "x.jpg"),
    });
    expect(crossed.ok).toBe(false);
    if (!crossed.ok) expect(crossed.message).toContain("attachments_path_boat");
    const loose = await attach(U.owner, U.owner.id, { path: "photo.jpg" });
    expect(loose.ok).toBe(false);
  });

  it("only images and PDF, 10 Mo at most", async () => {
    expect((await attach(U.owner, U.owner.id, { mime: "application/pdf" })).ok).toBe(true);
    expect((await attach(U.owner, U.owner.id, { mime: "application/zip" })).ok).toBe(false);
    expect((await attach(U.owner, U.owner.id, { bytes: 10 * 1024 * 1024 + 1 })).ok).toBe(false);
  });

  it("the owner of the document must exist and be on the same boat", async () => {
    const missing = await attach(U.owner, U.owner.id, {
      entityId: "00000000-0000-0000-0000-0000000099ff",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.message).toContain("attachment_owner_not_found");

    // The other boat's intervention exists, but this member cannot even see it.
    const foreign = await attach(U.owner, U.owner.id, {
      entityId: "00000000-0000-0000-0000-000000002101",
    });
    expect(foreign.ok).toBe(false);
  });

  it("update: owner/editor edit any legend, a pro only their own", async () => {
    const caption = (u: User, id: string) =>
      run(u, "update public.attachments set caption = 'Légende' where id = $1", [id]);
    expect(await caption(U.owner, ATT_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await caption(U.editor, ATT_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await caption(U.pro, ATT_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await caption(U.pro, ATT_OWNER)).toEqual({ ok: true, rowCount: 0 });
    expect(await caption(U.viewer, ATT_OWNER)).toEqual({ ok: true, rowCount: 0 });
    expect(await caption(U.stranger, ATT_OWNER)).toEqual({ ok: true, rowCount: 0 });
  });

  it("soft delete: owner/editor only — a pro cannot trash even their own document", async () => {
    const trash = (u: User, id: string) =>
      run(u, "update public.attachments set deleted_at = now() where id = $1", [id]);
    const pro = await trash(U.pro, ATT_PRO);
    expect(pro.ok).toBe(false);
    if (!pro.ok) expect(pro.code).toBe("42501");
    expect(await trash(U.owner, ATT_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await trash(U.editor, ATT_OWNER)).toEqual({ ok: true, rowCount: 1 });
    expect(await trash(U.viewer, ATT_OWNER)).toEqual({ ok: true, rowCount: 0 });
  });

  it("hard delete: owner/editor only, and a purged intervention takes its documents with it", async () => {
    expect(await run(U.pro, "delete from public.attachments where id = $1", [ATT_PRO])).toEqual({
      ok: true,
      rowCount: 0,
    });
    expect(await run(U.viewer, "delete from public.attachments where id = $1", [ATT_PRO])).toEqual({
      ok: true,
      rowCount: 0,
    });
    expect(await run(U.owner, "delete from public.attachments where id = $1", [ATT_PRO])).toEqual({
      ok: true,
      rowCount: 1,
    });

    const cascaded = await as(U.owner, async (c) => {
      await c.query("delete from public.maintenance_logs where id = $1", [LOG_OWNER]);
      const res = await c.query("select count(*)::int as n from public.attachments where id = $1", [
        ATT_OWNER,
      ]);
      return Number(res.rows[0]?.n);
    });
    expect(cascaded).toBe(0);
  });

  it("maintenance_logs_view: the paperclip counts only the documents that are not trashed", async () => {
    const countFor = (u: User) =>
      as(u, async (c) => {
        const res = await c.query(
          "select attachments_count from public.maintenance_logs_view where id = $1",
          [LOG_OWNER],
        );
        return Number(res.rows[0]?.attachments_count);
      });
    expect(await countFor(U.owner)).toBe(1);
    const afterTrash = await as(U.owner, async (c) => {
      await c.query("update public.attachments set deleted_at = now() where id = $1", [ATT_OWNER]);
      const res = await c.query(
        "select attachments_count from public.maintenance_logs_view where id = $1",
        [LOG_OWNER],
      );
      return Number(res.rows[0]?.attachments_count);
    });
    expect(afterTrash).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Tracking model (migration 0004_tracking.sql, docs/AUDIT.md §3.1)
// ---------------------------------------------------------------------------------------------
const COMPLETION_OWNER = "00000000-0000-0000-0000-000000004001";
const COMPLETION_PRO = "00000000-0000-0000-0000-000000004002";

describe("invitations issued by an editor (D28)", () => {
  const invite = (u: User, role: string, token: string, days: number | null) =>
    run(
      u,
      `insert into public.boat_invitations (boat_id, email, role, token, invited_by, valid_until)
       values ($1, 'meca@test.xaman', $2::public.boat_role, $3, $4, current_date + $5::int)`,
      [BOAT, role, token, u.id, days],
    );

  it("an editor may invite a pro or a viewer for 90 days at most", async () => {
    expect((await invite(U.editor, "pro", "ed-pro-30", 30)).ok, "pro 30 d").toBe(true);
    expect((await invite(U.editor, "viewer", "ed-viewer-90", 90)).ok, "viewer 90 d").toBe(true);
    expect((await invite(U.editor, "pro", "ed-pro-91", 91)).ok, "pro 91 d").toBe(false);
    expect((await invite(U.editor, "pro", "ed-pro-none", null)).ok, "pro, no end date").toBe(false);
    expect((await invite(U.editor, "editor", "ed-editor", 30)).ok, "editor role").toBe(false);
    expect((await invite(U.editor, "owner", "ed-owner", 30)).ok, "owner role").toBe(false);
  });

  it("an owner keeps inviting any role, with or without an end date", async () => {
    expect((await invite(U.owner, "editor", "ow-editor", null)).ok).toBe(true);
    expect((await invite(U.owner, "pro", "ow-pro", 365)).ok).toBe(true);
    expect((await invite(U.pro, "viewer", "pro-viewer", 30)).ok, "a pro invites nobody").toBe(
      false,
    );
    expect(
      (await invite(U.viewer, "viewer", "viewer-viewer", 30)).ok,
      "a viewer invites nobody",
    ).toBe(false);
  });

  it("accept_invitation carries valid_until over to the membership", async () => {
    const out = await as(U.stranger, async (c) => {
      await c.query("set local role service_role");
      await c.query(
        "update public.boat_invitations set valid_until = current_date + 30 where token = $1",
        [INVITATION_TOKEN],
      );
      await c.query("set local role authenticated");
      await c.query("select public.accept_invitation($1)", [INVITATION_TOKEN]);
      await c.query("set local role service_role");
      const res = await c.query(
        `select (valid_until = current_date + 30) as carried
         from public.boat_members where boat_id = $1 and user_id = $2`,
        [BOAT, U.stranger.id],
      );
      return res.rows[0] as { carried: boolean };
    });
    expect(out).toEqual({ carried: true });
  });
});

describe("cancelling a completion (D15)", () => {
  const del = (u: User, id: string) =>
    run(u, "delete from public.checklist_completions where id = $1", [id]);

  it("owner/editor delete any completion, a pro only their own and only within 24 h", async () => {
    expect(await del(U.owner, COMPLETION_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await del(U.editor, COMPLETION_OWNER)).toEqual({ ok: true, rowCount: 1 });
    expect(await del(U.pro, COMPLETION_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await del(U.pro, COMPLETION_OWNER)).toEqual({ ok: true, rowCount: 0 });
    expect(await del(U.viewer, COMPLETION_PRO)).toEqual({ ok: true, rowCount: 0 });
    expect(await del(U.stranger, COMPLETION_PRO)).toEqual({ ok: true, rowCount: 0 });
  });

  it("past 24 h the pro author can no longer cancel", async () => {
    const rows = await as(U.pro, async (c) => {
      await c.query("set local role service_role");
      await c.query(
        "update public.checklist_completions set created_at = now() - interval '25 hours' where id = $1",
        [COMPLETION_PRO],
      );
      await c.query("set local role authenticated");
      const res = await c.query("delete from public.checklist_completions where id = $1", [
        COMPLETION_PRO,
      ]);
      return res.rowCount;
    });
    expect(rows).toBe(0);
  });

  it("deleting a completion deletes the hour reading it produced (cascade)", async () => {
    const out = await as(U.owner, async (c) => {
      const inserted = await c.query(
        `insert into public.checklist_completions (boat_id, checklist_item_id, completed_at, engine_hours, created_by)
         values ($1, $2, current_date, 700, $3) returning id`,
        [BOAT, ITEM, U.owner.id],
      );
      const id = (inserted.rows[0] as { id: string }).id;
      const readings = async () =>
        Number(
          (
            await c.query(
              "select count(*)::int as n from public.engine_hour_readings where checklist_completion_id = $1",
              [id],
            )
          ).rows[0].n,
        );
      const before = await readings();
      await c.query("delete from public.checklist_completions where id = $1", [id]);
      return { before, after: await readings() };
    });
    expect(out).toEqual({ before: 1, after: 0 });
  });
});

describe("engine deletion guard (D14)", () => {
  it("an engine carrying readings or checklist items cannot be deleted", async () => {
    const used = await run(U.owner, "delete from public.engines where id = $1", [ENGINE]);
    expect(used.ok).toBe(false);
    if (!used.ok) expect(used.message).toContain("engine_in_use");
  });

  it("an engine created by mistake, without any data, is still deletable", async () => {
    const rows = await as(U.owner, async (c) => {
      const inserted = await c.query(
        "insert into public.engines (boat_id, label, position, created_by) values ($1, 'Neuf', 'port', $2) returning id",
        [BOAT, U.owner.id],
      );
      const res = await c.query("delete from public.engines where id = $1", [
        (inserted.rows[0] as { id: string }).id,
      ]);
      return res.rowCount;
    });
    expect(rows).toBe(1);
  });

  it("deleting the boat still cascades to its engines", async () => {
    const rows = await run(U.owner, "delete from public.boats where id = $1", [BOAT]);
    expect(rows).toEqual({ ok: true, rowCount: 1 });
  });
});

describe("trash and engine hour readings (D5)", () => {
  it("trashing a log parks its readings in pending_engine_hours, restoring recreates them", async () => {
    const out = await as(U.owner, async (c) => {
      const readings = async () =>
        Number(
          (
            await c.query(
              "select count(*)::int as n from public.engine_hour_readings where maintenance_log_id = $1",
              [LOG_OWNER],
            )
          ).rows[0].n,
        );
      const pending = async () =>
        (
          await c.query("select pending_engine_hours from public.maintenance_logs where id = $1", [
            LOG_OWNER,
          ])
        ).rows[0].pending_engine_hours as Record<string, number> | null;

      const before = await readings();
      await c.query("update public.maintenance_logs set deleted_at = now() where id = $1", [
        LOG_OWNER,
      ]);
      const trashed = { readings: await readings(), pending: await pending() };
      await c.query("update public.maintenance_logs set deleted_at = null where id = $1", [
        LOG_OWNER,
      ]);
      const restored = { readings: await readings(), pending: await pending() };
      return { before, trashed, restored };
    });
    expect(out.before).toBe(1);
    expect(out.trashed).toEqual({ readings: 0, pending: { [ENGINE]: 500 } });
    expect(out.restored).toEqual({ readings: 1, pending: null });
  });
});

describe("future dates (D17)", () => {
  it("a completion dated in the future is refused", async () => {
    const res = await run(
      U.owner,
      `insert into public.checklist_completions (boat_id, checklist_item_id, completed_at, engine_hours, created_by)
       values ($1, $2, current_date + 2, 700, $3)`,
      [BOAT, ITEM, U.owner.id],
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("23514");
      expect(res.message).toContain("date_in_future");
    }
  });

  it("an hour reading dated in the future is refused", async () => {
    const res = await run(
      U.owner,
      `insert into public.engine_hour_readings (boat_id, engine_id, hours, read_at, created_by)
       values ($1, $2, 700, current_date + 2, $3)`,
      [BOAT, ENGINE, U.owner.id],
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain("date_in_future");
  });

  it("today and tomorrow are accepted (the database is in UTC, the boat is not)", async () => {
    for (const offset of [0, 1]) {
      expect(
        (
          await run(
            U.owner,
            `insert into public.engine_hour_readings (boat_id, engine_id, hours, read_at, created_by)
             values ($1, $2, 700, current_date + $4::int, $3)`,
            [BOAT, ENGINE, U.owner.id, offset],
          )
        ).ok,
        `current_date + ${offset}`,
      ).toBe(true);
    }
  });
});

describe("status views", () => {
  const VIEWS = [
    "checklist_item_status",
    "checklist_category_progress",
    "boat_dashboard_stats",
    "maintenance_logs_view",
  ] as const;

  it.each(VIEWS)("%s: members see their boat, outsiders see nothing, anon is denied", async (v) => {
    for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
      expect(await count(U[role], v, "boat_id = $1", [BOAT]), `${role} on ${v}`).toBeGreaterThan(0);
    }
    expect(await count(U.stranger, v, "boat_id = $1", [BOAT])).toBe(0);
    expect(await count(null, v)).toBe(-1);
  });

  it("checklist_item_status hides items of a deactivated engine or category (A14, A15)", async () => {
    const visible = async (sql: string, params: unknown[]) =>
      as(U.owner, async (c) => {
        await c.query(sql, params);
        const res = await c.query(
          "select count(*)::int as n from public.checklist_item_status where id = $1",
          [ITEM],
        );
        return Number(res.rows[0].n);
      });
    expect(await visible("select 1", [])).toBe(1);
    expect(
      await visible("update public.engines set is_active = false where id = $1", [ENGINE]),
    ).toBe(0);
    expect(
      await visible("update public.boat_categories set is_active = false where id = $1", [
        CATEGORY,
      ]),
    ).toBe(0);
  });

  it("checklist_item_status neutralises the hour deadline after a counter reset (A13)", async () => {
    const row = await as(U.owner, async (c) => {
      const before = await c.query(
        "select due_hours::float8, status::text from public.checklist_item_status where id = $1",
        [ITEM],
      );
      await c.query("update public.engines set counter_reset_at = current_date where id = $1", [
        ENGINE,
      ]);
      const after = await c.query(
        "select due_hours::float8, reference_hours::float8, status::text from public.checklist_item_status where id = $1",
        [ITEM],
      );
      return { before: before.rows[0], after: after.rows[0] };
    });
    expect(row.before).toMatchObject({ due_hours: 850 });
    expect(row.after).toMatchObject({ due_hours: null, reference_hours: null });
  });

  it("checklist_item_status keeps the most recent completion of the day (A18)", async () => {
    const hours = await as(U.owner, async (c) => {
      for (const [engineHours, ago] of [
        [800, "1 hour"],
        [900, "1 minute"],
      ] as const) {
        await c.query(
          `insert into public.checklist_completions (boat_id, checklist_item_id, completed_at, engine_hours, created_by, created_at)
           values ($1, $2, current_date, $3, $4, now() - $5::interval)`,
          [BOAT, ITEM, engineHours, U.owner.id, ago],
        );
      }
      const res = await c.query(
        "select last_engine_hours::float8 from public.checklist_item_status where id = $1",
        [ITEM],
      );
      return res.rows[0].last_engine_hours as number;
    });
    expect(hours).toBe(900);
  });
});

// E1-6b: the secondary views follow the same tenant isolation as the tables they read.
describe("secondary views", () => {
  it.each(["expenses_by_category", "engine_current_hours"] as const)(
    "%s: members see their boat, outsiders see nothing, anon is denied",
    async (v) => {
      for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
        expect(await count(U[role], v, "boat_id = $1", [BOAT]), `${role} on ${v}`).toBeGreaterThan(
          0,
        );
      }
      expect(await count(U.stranger, v, "boat_id = $1", [BOAT])).toBe(0);
      expect(await count(null, v)).toBe(-1);
    },
  );

  it("boat_invitations_safe: owners and the admin only, never the token", async () => {
    expect(await count(U.owner, "boat_invitations_safe", "boat_id = $1", [BOAT])).toBeGreaterThan(
      0,
    );
    expect(await count(U.admin, "boat_invitations_safe", "boat_id = $1", [BOAT])).toBeGreaterThan(
      0,
    );
    for (const role of ["editor", "pro", "viewer", "stranger"] as Role[]) {
      expect(await count(U[role], "boat_invitations_safe", "boat_id = $1", [BOAT]), role).toBe(0);
    }
    const columns = await as(U.owner, async (c) => {
      const res = await c.query(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'boat_invitations_safe'",
      );
      return res.rows.map((row) => row.column_name as string);
    });
    expect(columns).not.toContain("token");
    expect(columns).toContain("valid_until");
  });

  it("maintenance_logs_trash_view: a trashed log shows for owner/editor, nothing for outsiders", async () => {
    const seen = async (u: User) =>
      as(u, async (c) => {
        await c.query("set local role service_role");
        await c.query("update public.maintenance_logs set deleted_at = now() where id = $1", [
          LOG_OWNER,
        ]);
        await c.query("set local role authenticated");
        const res = await c.query(
          "select count(*)::int as n from public.maintenance_logs_trash_view where id = $1",
          [LOG_OWNER],
        );
        return Number(res.rows[0]?.n);
      });
    expect(await seen(U.owner)).toBe(1);
    expect(await seen(U.editor)).toBe(1);
    expect(await seen(U.stranger)).toBe(0);
    expect(await count(null, "maintenance_logs_trash_view")).toBe(-1);
  });
});

describe("boat_todo_queue", () => {
  const seedQueue = async (c: PoolClient) => {
    await c.query("set local role service_role");
    await c.query(
      `insert into public.maintenance_logs (boat_id, title, category_id, status, performed_at, created_by)
       values ($1, 'Fuite bâbord', $2, 'urgent', current_date - 3, $3)`,
      [BOAT, CATEGORY, U.owner.id],
    );
    await c.query(
      `insert into public.checklist_items (boat_id, category_id, label, interval_months, anchor_date, created_by)
       values ($1, $2, 'Point en retard', 6, current_date - interval '8 months', $3),
              ($1, $2, 'Contrôle ponctuel', null, current_date, $3)`,
      [BOAT, CATEGORY, U.owner.id],
    );
    await c.query("set local role authenticated");
  };

  const queueOf = (u: User) =>
    as(u, async (c) => {
      await seedQueue(c);
      const res = await c.query(
        "select rank, kind, title, status from public.boat_todo_queue($1::uuid, 10)",
        [BOAT],
      );
      return res.rows as { rank: number; kind: string; title: string; status: string }[];
    });

  it("every member sees the queue, ranked, and one-off items never enter it", async () => {
    for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
      const rows = await queueOf(U[role]);
      expect(
        rows.map((r) => [r.rank, r.kind, r.title]),
        role,
      ).toEqual([
        [0, "log", "Fuite bâbord"],
        [1, "item", "Point en retard"],
      ]);
      expect(
        rows.some((r) => r.title === "Contrôle ponctuel"),
        role,
      ).toBe(false);
    }
  });

  it("an outsider gets an empty queue", async () => {
    expect(await queueOf(U.stranger)).toEqual([]);
  });
});

describe("journal helpers (0005)", () => {
  const suggestions = (u: User | null, query: string) =>
    as(u, async (c) => {
      try {
        const res = await c.query(
          "select title, category_id, engine_id, occurrences from public.log_title_suggestions($1::uuid, $2)",
          [BOAT, query],
        );
        return res.rows as {
          title: string;
          category_id: string | null;
          engine_id: string | null;
          occurrences: number;
        }[];
      } catch {
        return null; // permission denied (anon)
      }
    });

  const items = (u: User | null, title: string) =>
    as(u, async (c) => {
      try {
        const res = await c.query(
          "select id, label, engine_id, status::text, score::float8 from public.suggest_checklist_items($1::uuid, $2::uuid, $3)",
          [BOAT, CATEGORY, title],
        );
        return res.rows as {
          id: string;
          label: string;
          engine_id: string | null;
          status: string;
          score: number;
        }[];
      } catch {
        return null;
      }
    });

  it("every member gets the titles of their boat, with category and engine", async () => {
    for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
      const rows = await suggestions(U[role], "vid");
      // equal occurrences: the most recent title comes first
      expect(
        rows?.map((r) => r.title),
        role,
      ).toEqual(["Vidange (pro)", "Vidange (owner)"]);
      expect(rows?.[0], role).toMatchObject({
        category_id: CATEGORY,
        engine_id: ENGINE,
        occurrences: 1,
      });
    }
  });

  it("the match ignores case, needs 2 characters and treats % as text", async () => {
    expect((await suggestions(U.owner, "VIDANGE"))?.length).toBe(2);
    expect((await suggestions(U.owner, "v"))?.length).toBe(0);
    expect((await suggestions(U.owner, "%"))?.length).toBe(0);
  });

  it("accents are folded on both sides", async () => {
    const rows = await as(U.owner, async (c) => {
      await c.query("update public.maintenance_logs set title = 'Carénage' where id = $1", [
        LOG_PRO,
      ]);
      const res = await c.query("select title from public.log_title_suggestions($1::uuid, $2)", [
        BOAT,
        "carenage",
      ]);
      return res.rows.map((r) => r.title as string);
    });
    expect(rows).toEqual(["Carénage"]);
  });

  it("an outsider sees nothing and anon cannot execute the function", async () => {
    expect(await suggestions(U.stranger, "vid")).toEqual([]);
    expect(await suggestions(null, "vid")).toBeNull();
  });

  it("a trashed log stops suggesting its title", async () => {
    const rows = await as(U.owner, async (c) => {
      await c.query("update public.maintenance_logs set deleted_at = now() where id = $1", [
        LOG_PRO,
      ]);
      const res = await c.query("select title from public.log_title_suggestions($1::uuid, $2)", [
        BOAT,
        "vid",
      ]);
      return res.rows.map((r) => r.title as string);
    });
    expect(rows).toEqual(["Vidange (owner)"]);
  });

  it("suggest_checklist_items matches the point of the category above 0.5", async () => {
    for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
      const rows = await items(U[role], "Vidange moteur");
      expect(
        rows?.map((r) => r.id),
        role,
      ).toEqual([ITEM]);
      expect(rows?.[0]?.score ?? 0, role).toBeGreaterThan(0.5);
      expect(rows?.[0]?.engine_id, role).toBe(ENGINE);
    }
  });

  it("an unrelated title matches nothing, and a title under 3 characters is not searched", async () => {
    expect(await items(U.owner, "Réparation de la grand-voile")).toEqual([]);
    expect(await items(U.owner, "Vi")).toEqual([]);
  });

  it("an outsider sees no point and anon cannot execute the function", async () => {
    expect(await items(U.stranger, "Vidange moteur")).toEqual([]);
    expect(await items(null, "Vidange moteur")).toBeNull();
  });

  it("a deactivated point leaves the suggestions", async () => {
    const rows = await as(U.owner, async (c) => {
      await c.query("update public.checklist_items set is_active = false where id = $1", [ITEM]);
      const res = await c.query(
        "select id from public.suggest_checklist_items($1::uuid, $2::uuid, $3)",
        [BOAT, CATEGORY, "Vidange moteur"],
      );
      return res.rows;
    });
    expect(rows).toEqual([]);
  });
});

describe("parts stock (0010)", () => {
  const PART = "00000000-0000-0000-0000-000000006001";

  it("an editor adjusts the quantity atomically and the line counts as checked", async () => {
    const result = await as(U.editor, async (c) => {
      const before = await c.query("select quantity from public.parts where id = $1", [PART]);
      const returned = await c.query("select public.adjust_part_quantity($1, 2) as quantity", [
        PART,
      ]);
      const after = await c.query("select quantity, checked_at from public.parts where id = $1", [
        PART,
      ]);
      return {
        before: Number(before.rows[0].quantity),
        returned: Number(returned.rows[0].quantity),
        after: Number(after.rows[0].quantity),
        checked: after.rows[0].checked_at as Date | null,
      };
    });
    expect(result.returned).toBe(result.before + 2);
    expect(result.after).toBe(result.before + 2);
    expect(result.checked).not.toBeNull();
  });

  it("floors the quantity at zero", async () => {
    const result = await as(U.owner, async (c) => {
      const returned = await c.query("select public.adjust_part_quantity($1, -50) as quantity", [
        PART,
      ]);
      return Number(returned.rows[0].quantity);
    });
    expect(result).toBe(0);
  });

  it("refuses a null delta", async () => {
    const result = await run(U.owner, "select public.adjust_part_quantity($1, 0)", [PART]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("invalid_delta");
  });

  it("a pro, a viewer or a stranger update no row", async () => {
    for (const user of [U.pro, U.viewer, U.stranger]) {
      const result = await run(user, "select public.adjust_part_quantity($1, 1)", [PART]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("part_not_found");
    }
  });

  it("anon cannot execute the function", async () => {
    const result = await run(null, "select public.adjust_part_quantity($1, 1)", [PART]);
    expect(result.ok).toBe(false);
  });

  it("only an owner or an editor deletes a part", async () => {
    const editor = await run(U.editor, "delete from public.parts where id = $1", [PART]);
    expect(editor).toEqual({ ok: true, rowCount: 1 });
    const pro = await run(U.pro, "delete from public.parts where id = $1", [PART]);
    expect(pro).toEqual({ ok: true, rowCount: 0 });
  });

  it("adjusting a trashed part fails: the + / − of the list cannot touch the trash", async () => {
    // One connection throughout: a second one would block on the row this transaction locked.
    const message = await as(U.owner, async (c) => {
      await c.query("update public.parts set deleted_at = now() where id = $1", [PART]);
      try {
        await c.query("select public.adjust_part_quantity($1, 1)", [PART]);
        return "ok";
      } catch (e) {
        return String((e as { message?: string }).message);
      }
    });
    // The trashed row is invisible to the function even though the caller may write the table.
    expect(message).toContain("part_not_found");
  });
});

// ---------------------------------------------------------------------------------------------
// The trash covers the stock and the directory (migration 0012, D40 / D41)
// ---------------------------------------------------------------------------------------------
describe("trash for parts and contacts (0012)", () => {
  const PART = "00000000-0000-0000-0000-000000006001";
  const CONTACT = "00000000-0000-0000-0000-00000000d001";

  it.each([
    ["parts", PART],
    ["contacts", CONTACT],
  ] as const)(
    "%s: owner and editor may trash and restore; pro, viewer and stranger may not",
    async (table, id) => {
      const trash = (u: User) =>
        run(u, `update public.${table} set deleted_at = now() where id = $1`, [id]);
      const restore = (u: User) =>
        run(u, `update public.${table} set deleted_at = null where id = $1`, [id]);

      expect(await trash(U.owner)).toEqual({ ok: true, rowCount: 1 });
      expect(await trash(U.editor)).toEqual({ ok: true, rowCount: 1 });
      expect(await trash(U.admin)).toEqual({ ok: true, rowCount: 1 });
      // A pro or a viewer has no update right at all on these tables: zero rows, not an error.
      expect(await trash(U.pro)).toEqual({ ok: true, rowCount: 0 });
      expect(await trash(U.viewer)).toEqual({ ok: true, rowCount: 0 });
      expect(await trash(U.stranger)).toEqual({ ok: true, rowCount: 0 });

      expect(await restore(U.owner)).toEqual({ ok: true, rowCount: 1 });
      expect(await restore(U.editor)).toEqual({ ok: true, rowCount: 1 });
      expect(await restore(U.pro)).toEqual({ ok: true, rowCount: 0 });
      expect(await restore(U.viewer)).toEqual({ ok: true, rowCount: 0 });
    },
  );

  it.each([
    ["parts", PART],
    ["contacts", CONTACT],
  ] as const)("%s: a trashed row is still readable by every member", async (table, id) => {
    const seen = async (u: User) =>
      as(u, async (c) => {
        await c.query("set local role service_role");
        await c.query(`update public.${table} set deleted_at = now() where id = $1`, [id]);
        await c.query("set local role authenticated");
        const res = await c.query(`select count(*)::int as n from public.${table} where id = $1`, [
          id,
        ]);
        return Number(res.rows[0]?.n);
      });
    // The trash screen is a plain select with `deleted_at is not null`: no policy hides the row.
    expect(await seen(U.owner)).toBe(1);
    expect(await seen(U.editor)).toBe(1);
    expect(await seen(U.stranger)).toBe(0);
    expect(await count(null, table)).toBe(-1);
  });

  it.each([
    ["parts", PART],
    ["contacts", CONTACT],
  ] as const)(
    "%s: the natural key ignores the trash, so a re-import can re-create what was removed",
    async (table, id) => {
      const result = await as(U.owner, async (c) => {
        const ref = await c.query(
          `select boat_id, external_ref from public.${table} where id = $1`,
          [id],
        );
        const row = ref.rows[0] as { boat_id: string; external_ref: string };
        await c.query(`update public.${table} set deleted_at = now() where id = $1`, [id]);
        const columns =
          table === "parts"
            ? "(boat_id, name, external_ref, created_by)"
            : "(boat_id, name, specialty, external_ref, created_by)";
        const values =
          table === "parts"
            ? "($1, 'Re-imported', $2, $3)"
            : "($1, 'Re-imported', 'Autre', $2, $3)";
        try {
          await c.query(`insert into public.${table} ${columns} values ${values}`, [
            row.boat_id,
            row.external_ref,
            U.owner.id,
          ]);
          return "ok";
        } catch (e) {
          return String((e as { code?: string }).code);
        }
      });
      // Before 0012 this raised 23505 against a row the person could no longer see.
      expect(result).toBe("ok");
    },
  );

  it("a live row still cannot take an external_ref another live row holds", async () => {
    const result = await as(U.owner, async (c) => {
      const ref = await c.query("select boat_id, external_ref from public.parts where id = $1", [
        PART,
      ]);
      const row = ref.rows[0] as { boat_id: string; external_ref: string };
      try {
        await c.query(
          "insert into public.parts (boat_id, name, external_ref, created_by) values ($1, 'Doublon', $2, $3)",
          [row.boat_id, row.external_ref, U.owner.id],
        );
        return "ok";
      } catch (e) {
        return String((e as { code?: string }).code);
      }
    });
    expect(result).toBe("23505");
  });

  it("the dashboard stops counting a trashed part as missing from the stock", async () => {
    const counts = await as(U.owner, async (c) => {
      const before = await c.query(
        "select low_stock_parts from public.boat_dashboard_stats where boat_id = $1",
        [BOAT],
      );
      await c.query("update public.parts set deleted_at = now() where id = $1", [PART]);
      const after = await c.query(
        "select low_stock_parts from public.boat_dashboard_stats where boat_id = $1",
        [BOAT],
      );
      return {
        before: Number(before.rows[0]?.low_stock_parts),
        after: Number(after.rows[0]?.low_stock_parts),
      };
    });
    // The seeded part is below its threshold, so it counted before and must not count after.
    expect(counts.before).toBe(1);
    expect(counts.after).toBe(0);
  });

  it("purge_trash removes parts, contacts and attachments past 30 days, and nothing younger", async () => {
    const result = await as(null, async (c) => {
      await c.query("set local role service_role");
      await c.query(
        "update public.parts set deleted_at = now() - interval '31 days' where id = $1",
        [PART],
      );
      await c.query(
        "update public.contacts set deleted_at = now() - interval '31 days' where id = $1",
        [CONTACT],
      );
      await c.query(
        "update public.attachments set deleted_at = now() - interval '31 days' where id = $1",
        [ATT_OWNER],
      );
      const fresh = await c.query(
        "insert into public.parts (boat_id, name, deleted_at, created_by) values ($1, 'Hier', now() - interval '1 day', $2) returning id",
        [BOAT, U.owner.id],
      );
      await c.query("select public.purge_trash()");
      const left = await c.query(
        `select
           (select count(*)::int from public.parts where id = $1) as part,
           (select count(*)::int from public.contacts where id = $2) as contact,
           (select count(*)::int from public.attachments where id = $3) as attachment,
           (select count(*)::int from public.parts where id = $4) as fresh_part`,
        [PART, CONTACT, ATT_OWNER, fresh.rows[0].id],
      );
      return left.rows[0] as Record<string, number>;
    });
    expect(result.part).toBe(0);
    expect(result.contact).toBe(0);
    expect(result.attachment).toBe(0);
    expect(result.fresh_part).toBe(1);
  });

  it("purge_trash stays out of reach of authenticated and anon", async () => {
    for (const user of [U.owner, U.admin, null]) {
      const result = await run(user, "select public.purge_trash()");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("42501");
    }
  });

  it("purging a contact leaves the history and only severs the link", async () => {
    const after = await as(U.owner, async (c) => {
      await c.query("update public.maintenance_logs set contact_id = $2 where id = $1", [
        LOG_OWNER,
        CONTACT,
      ]);
      await c.query("set local role service_role");
      await c.query(
        "update public.contacts set deleted_at = now() - interval '31 days' where id = $1",
        [CONTACT],
      );
      await c.query("select public.purge_trash()");
      const res = await c.query(
        "select title, contact_id from public.maintenance_logs where id = $1",
        [LOG_OWNER],
      );
      return res.rows[0] as { title: string; contact_id: string | null };
    });
    // `on delete set null`: the intervention survives, only the pointer goes.
    expect(after.title).toBeTruthy();
    expect(after.contact_id).toBeNull();
  });
});

describe("trash for equipment (0014)", () => {
  const EQUIP = "00000000-0000-0000-0000-00000000f001";

  it("owner and editor may trash and restore; pro, viewer and stranger may not", async () => {
    const trash = (u: User) =>
      run(u, "update public.equipment set deleted_at = now() where id = $1", [EQUIP]);
    const restore = (u: User) =>
      run(u, "update public.equipment set deleted_at = null where id = $1", [EQUIP]);

    expect(await trash(U.owner)).toEqual({ ok: true, rowCount: 1 });
    expect(await trash(U.editor)).toEqual({ ok: true, rowCount: 1 });
    expect(await trash(U.admin)).toEqual({ ok: true, rowCount: 1 });
    // A pro or a viewer has no update right on equipment: zero rows, not an error.
    expect(await trash(U.pro)).toEqual({ ok: true, rowCount: 0 });
    expect(await trash(U.viewer)).toEqual({ ok: true, rowCount: 0 });
    expect(await trash(U.stranger)).toEqual({ ok: true, rowCount: 0 });

    expect(await restore(U.owner)).toEqual({ ok: true, rowCount: 1 });
    expect(await restore(U.editor)).toEqual({ ok: true, rowCount: 1 });
    expect(await restore(U.pro)).toEqual({ ok: true, rowCount: 0 });
    expect(await restore(U.viewer)).toEqual({ ok: true, rowCount: 0 });
  });

  it("a trashed equipment is still readable by every member", async () => {
    const seen = async (u: User) =>
      as(u, async (c) => {
        await c.query("set local role service_role");
        await c.query("update public.equipment set deleted_at = now() where id = $1", [EQUIP]);
        await c.query("set local role authenticated");
        const res = await c.query("select count(*)::int as n from public.equipment where id = $1", [
          EQUIP,
        ]);
        return Number(res.rows[0]?.n);
      });
    // The trash screen is a plain select with `deleted_at is not null`: no policy hides the row.
    expect(await seen(U.owner)).toBe(1);
    expect(await seen(U.editor)).toBe(1);
    expect(await seen(U.stranger)).toBe(0);
    expect(await count(null, "equipment")).toBe(-1);
  });

  it("purge_trash removes equipment past 30 days, and nothing younger", async () => {
    const result = await as(null, async (c) => {
      await c.query("set local role service_role");
      await c.query(
        "update public.equipment set deleted_at = now() - interval '31 days' where id = $1",
        [EQUIP],
      );
      const fresh = await c.query(
        "insert into public.equipment (boat_id, name, deleted_at, created_by) values ($1, 'Hier', now() - interval '1 day', $2) returning id",
        [BOAT, U.owner.id],
      );
      await c.query("select public.purge_trash()");
      const left = await c.query(
        `select
           (select count(*)::int from public.equipment where id = $1) as equip,
           (select count(*)::int from public.equipment where id = $2) as fresh_equip`,
        [EQUIP, fresh.rows[0].id],
      );
      return left.rows[0] as Record<string, number>;
    });
    expect(result.equip).toBe(0);
    expect(result.fresh_equip).toBe(1);
  });

  it("purging an equipment leaves the history and only severs the link", async () => {
    const after = await as(U.owner, async (c) => {
      await c.query("update public.maintenance_logs set equipment_id = $2 where id = $1", [
        LOG_OWNER,
        EQUIP,
      ]);
      await c.query("set local role service_role");
      await c.query(
        "update public.equipment set deleted_at = now() - interval '31 days' where id = $1",
        [EQUIP],
      );
      await c.query("select public.purge_trash()");
      const res = await c.query(
        "select title, equipment_id from public.maintenance_logs where id = $1",
        [LOG_OWNER],
      );
      return res.rows[0] as { title: string; equipment_id: string | null };
    });
    // `on delete set null`: the intervention survives, only the pointer goes.
    expect(after.title).toBeTruthy();
    expect(after.equipment_id).toBeNull();
  });
});

/**
 * D42 — why a Server Action never upserts a row it knows already exists.
 *
 * `maintenance_logs_insert` (and the same policy on `attachments`, `checklist_completions`
 * and `engine_hour_readings`) checks `created_by = auth.uid()`. Postgres evaluates that
 * WITH CHECK against the row **proposed** by an `insert … on conflict do update`, before it
 * ever looks at the conflicting row. So an upsert that deliberately leaves `created_by` out —
 * which E10-4 requires, « créé par » must keep naming whoever wrote the line — is refused for
 * everyone, the owner of the boat included.
 *
 * That is not a policy to loosen: it is what stops a `pro` from filing a line under someone
 * else's name. The action is what must change, and these cases pin both halves.
 */
describe("editing an existing row (D42)", () => {
  const UPSERT_WITHOUT_CREATED_BY = `
    insert into public.maintenance_logs (id, boat_id, title, status, performed_at, updated_by)
    values ($1, $2, 'Réécrit par un upsert', 'done', current_date, auth.uid())
    on conflict (id) do update
      set title = excluded.title, status = excluded.status,
          performed_at = excluded.performed_at, updated_by = excluded.updated_by`;

  it("refuses the upsert an owner would have been allowed to do as an update", async () => {
    const upsert = await run(U.owner, UPSERT_WITHOUT_CREATED_BY, [LOG_OWNER, BOAT]);
    expect(upsert.ok).toBe(false);
    if (!upsert.ok) expect(upsert.code).toBe("42501");

    // The very same edit, expressed as the UPDATE it really is, goes through.
    expect(
      await run(U.owner, "update public.maintenance_logs set title = $2 where id = $1", [
        LOG_OWNER,
        "Réécrit par un update",
      ]),
    ).toEqual({ ok: true, rowCount: 1 });
  });

  it("refuses it for an editor too, on a line someone else created", async () => {
    const upsert = await run(U.editor, UPSERT_WITHOUT_CREATED_BY, [LOG_PRO, BOAT]);
    expect(upsert.ok).toBe(false);
    if (!upsert.ok) expect(upsert.code).toBe("42501");

    expect(
      await run(U.editor, "update public.maintenance_logs set title = $2 where id = $1", [
        LOG_PRO,
        "Corrigé par l'éditeur",
      ]),
    ).toEqual({ ok: true, rowCount: 1 });
  });

  it("still lets creation upsert, so a double tap writes one row (rule 11)", async () => {
    const NEW_ID = "00000000-0000-0000-0000-0000000042a1";
    const create = `
      insert into public.maintenance_logs (id, boat_id, title, status, performed_at, created_by, updated_by)
      values ($1, $2, 'Créée deux fois', 'done', current_date, auth.uid(), auth.uid())
      on conflict (id) do update set title = excluded.title`;
    expect(await run(U.owner, create, [NEW_ID, BOAT])).toEqual({ ok: true, rowCount: 1 });
    expect(await run(U.owner, create, [NEW_ID, BOAT])).toEqual({ ok: true, rowCount: 1 });
  });
});
