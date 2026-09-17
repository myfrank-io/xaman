/**
 * The checklist and the journal are one thing (D140, migration 0042), and « Confier au
 * chantier » rides on it (D141).
 *
 * Runs against a Postgres that has the migrations + supabase/seed.sql applied, like
 * `rls.test.ts`: DATABASE_URL, or the suite skips itself. Every case runs inside a transaction
 * that is rolled back, impersonating a user exactly like PostgREST does.
 *
 * What is proven here is the invariant the screens rely on and no TypeScript can check:
 *
 *   an intervention that is the doing of a point ticks it when — and only when — it is done and
 *   alive, with the intervention's own date, hours and provider.
 */
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

type User = { id: string; email: string };

const OWNER: User = { id: "00000000-0000-0000-0000-000000000011", email: "owner@test.xaman" };
const PRO: User = { id: "00000000-0000-0000-0000-000000000013", email: "pro@test.xaman" };
const VIEWER: User = { id: "00000000-0000-0000-0000-000000000014", email: "viewer@test.xaman" };
const STRANGER: User = {
  id: "00000000-0000-0000-0000-000000000015",
  email: "stranger@test.xaman",
};

const BOAT = "00000000-0000-0000-0000-00000000b001";
const BOAT2 = "00000000-0000-0000-0000-00000000b002";
const CATEGORY = "00000000-0000-0000-0000-00000000ca01";
const ENGINE = "00000000-0000-0000-0000-00000000e001";
/** Seeded hour-based point: 12 months / 250 h on ENGINE. */
const ITEM = "00000000-0000-0000-0000-000000003001";
const YARD = "00000000-0000-0000-0000-00000000d001";

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

afterAll(async () => {
  await pool.end();
});

/** One rolled-back transaction, as `user` (PostgREST's `set local role` + claims). */
async function as<T>(user: User, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" }),
    ]);
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

type Completion = {
  completed_at: string;
  engine_hours: number | null;
  completed_by: string | null;
  completed_by_name: string | null;
  created_by: string | null;
};

async function completionsOf(c: PoolClient, logId: string): Promise<Completion[]> {
  const res = await c.query(
    `select to_char(completed_at, 'YYYY-MM-DD') as completed_at, engine_hours::float8, completed_by,
            completed_by_name, created_by
       from public.checklist_completions
      where maintenance_log_id = $1 and checklist_item_id = $2`,
    [logId, ITEM],
  );
  return res.rows as Completion[];
}

async function insertLog(
  c: PoolClient,
  user: User,
  values: { id: string; status: string; performedAt: string; contactId?: string | null },
) {
  await c.query(
    `insert into public.maintenance_logs (id, boat_id, title, category_id, status, performed_at, contact_id, checklist_item_id, created_by)
     values ($1, $2, 'Vidange huile moteur — Moteur', $3, $4::public.log_status, $5::date, $6, $7, $8)`,
    [
      values.id,
      BOAT,
      CATEGORY,
      values.status,
      values.performedAt,
      values.contactId ?? null,
      ITEM,
      user.id,
    ],
  );
}

async function insertReading(c: PoolClient, user: User, logId: string, hours: number, at: string) {
  await c.query(
    `insert into public.engine_hour_readings (boat_id, engine_id, hours, read_at, source, maintenance_log_id, created_by)
     values ($1, $2, $3, $4::date, 'maintenance_log', $5, $6)`,
    [BOAT, ENGINE, hours, at, logId, user.id],
  );
}

const LOG = "00000000-0000-0000-0000-000000002a01";

describeWithDb("an intervention that is the doing of a point (D140)", () => {
  it("ticks the point once its hours are there, with its date and hours, as the pro who wrote it", async () => {
    const out = await as(PRO, async (c) => {
      await insertLog(c, PRO, { id: LOG, status: "done", performedAt: "2026-09-10" });
      // An hour-based point: nothing until the reading the form writes next lands.
      const before = await completionsOf(c, LOG);
      await insertReading(c, PRO, LOG, 700, "2026-09-10");
      const after = await completionsOf(c, LOG);
      const status = await c.query(
        "select status::text, to_char(last_completed_at, 'YYYY-MM-DD') as last, last_engine_hours::float8 as hours from public.checklist_item_status where id = $1",
        [ITEM],
      );
      return { before, after, status: status.rows[0] };
    });
    expect(out.before).toEqual([]);
    expect(out.after).toEqual([
      {
        completed_at: "2026-09-10",
        engine_hours: 700,
        completed_by: PRO.id,
        completed_by_name: null,
        created_by: PRO.id,
      },
    ]);
    expect(out.status).toEqual({ status: "ok", last: "2026-09-10", hours: 700 });
  });

  it("ticks a point without hours from the line alone", async () => {
    const n = await as(OWNER, async (c) => {
      const item = await c.query(
        `insert into public.checklist_items (boat_id, category_id, label, interval_months, anchor_date, created_by)
         values ($1, $2, 'Contrôle des ridoirs', 6, current_date - interval '8 months', $3) returning id`,
        [BOAT, CATEGORY, OWNER.id],
      );
      const itemId = (item.rows[0] as { id: string }).id;
      const log = "00000000-0000-0000-0000-000000002a02";
      await c.query(
        `insert into public.maintenance_logs (id, boat_id, title, category_id, status, performed_at, checklist_item_id, created_by)
         values ($1, $2, 'Contrôle des ridoirs', $3, 'done', current_date, $4, $5)`,
        [log, BOAT, CATEGORY, itemId, OWNER.id],
      );
      const res = await c.query(
        "select count(*)::int as n, max(status::text) as status from public.checklist_completions cc join public.checklist_item_status s on s.id = cc.checklist_item_id where cc.maintenance_log_id = $1",
        [log],
      );
      return res.rows[0] as { n: number; status: string };
    });
    expect(n).toEqual({ n: 1, status: "ok" });
  });

  it("follows the line: date edited, provider named, then planned again, trashed, restored", async () => {
    const out = await as(OWNER, async (c) => {
      await insertLog(c, OWNER, { id: LOG, status: "done", performedAt: "2026-09-10" });
      await insertReading(c, OWNER, LOG, 700, "2026-09-10");
      const steps: Record<string, Completion[]> = {};

      await c.query(
        "update public.maintenance_logs set performed_at = '2026-09-08' where id = $1",
        [LOG],
      );
      steps.redated = await completionsOf(c, LOG);

      await c.query("update public.maintenance_logs set contact_id = $2 where id = $1", [
        LOG,
        YARD,
      ]);
      steps.provider = await completionsOf(c, LOG);

      await c.query("update public.maintenance_logs set status = 'planned' where id = $1", [LOG]);
      steps.planned = await completionsOf(c, LOG);

      await c.query("update public.maintenance_logs set status = 'done' where id = $1", [LOG]);
      steps.doneAgain = await completionsOf(c, LOG);

      await c.query("update public.maintenance_logs set deleted_at = now() where id = $1", [LOG]);
      steps.trashed = await completionsOf(c, LOG);

      await c.query("update public.maintenance_logs set deleted_at = null where id = $1", [LOG]);
      steps.restored = await completionsOf(c, LOG);
      return steps;
    });
    expect(out.redated).toMatchObject([{ completed_at: "2026-09-08", engine_hours: 700 }]);
    // « Réalisé par » is the provider of the line (D32), frozen by name (D31).
    expect(out.provider).toMatchObject([{ completed_by_name: "Chantier test" }]);
    expect(out.planned).toEqual([]);
    expect(out.doneAgain).toMatchObject([{ completed_at: "2026-09-08", engine_hours: 700 }]);
    expect(out.trashed).toEqual([]);
    expect(out.restored).toMatchObject([{ engine_hours: 700 }]);
  });

  it("unticks an hour-based point when the reading it relied on goes", async () => {
    const out = await as(OWNER, async (c) => {
      await insertLog(c, OWNER, { id: LOG, status: "done", performedAt: "2026-09-10" });
      await insertReading(c, OWNER, LOG, 700, "2026-09-10");
      const withReading = (await completionsOf(c, LOG)).length;
      await c.query("delete from public.engine_hour_readings where maintenance_log_id = $1", [LOG]);
      return { withReading, without: (await completionsOf(c, LOG)).length };
    });
    expect(out).toEqual({ withReading: 1, without: 0 });
  });

  it("re-pointed to another point, it leaves the first one alone", async () => {
    const out = await as(OWNER, async (c) => {
      const other = await c.query(
        `insert into public.checklist_items (boat_id, category_id, label, interval_months, anchor_date, created_by)
         values ($1, $2, 'Autre point', 12, current_date, $3) returning id`,
        [BOAT, CATEGORY, OWNER.id],
      );
      const otherId = (other.rows[0] as { id: string }).id;
      await insertLog(c, OWNER, { id: LOG, status: "done", performedAt: "2026-09-10" });
      await insertReading(c, OWNER, LOG, 700, "2026-09-10");
      await c.query("update public.maintenance_logs set checklist_item_id = $2 where id = $1", [
        LOG,
        otherId,
      ]);
      const res = await c.query(
        "select checklist_item_id from public.checklist_completions where maintenance_log_id = $1",
        [LOG],
      );
      return res.rows.map((r) => (r as { checklist_item_id: string }).checklist_item_id);
    });
    expect(out).toEqual([expect.not.stringMatching(ITEM)]);
    expect(out).toHaveLength(1);
  });

  it("refuses a point of another boat, and hides the column's meaning from nobody", async () => {
    const refused = await as(STRANGER, async (c) => {
      try {
        await c.query(
          `insert into public.maintenance_logs (boat_id, title, status, performed_at, checklist_item_id, created_by)
           values ($1, 'Mauvais bateau', 'done', current_date, $2, $3)`,
          [BOAT2, ITEM, STRANGER.id],
        );
        return null;
      } catch (e) {
        return (e as { code?: string; message: string }).message;
      }
    });
    // The point is not even visible to the stranger: the boat check refuses before RLS would.
    expect(refused).toContain("checklist_item_boat_mismatch");
  });

  it("purges the completion with the line, thirty days later", async () => {
    const out = await as(OWNER, async (c) => {
      await insertLog(c, OWNER, { id: LOG, status: "done", performedAt: "2026-09-10" });
      await insertReading(c, OWNER, LOG, 700, "2026-09-10");
      await c.query("update public.maintenance_logs set deleted_at = now() where id = $1", [LOG]);
      await c.query("delete from public.maintenance_logs where id = $1", [LOG]);
      const res = await c.query(
        "select count(*)::int as n from public.checklist_completions where checklist_item_id = $1 and completed_at = '2026-09-10'",
        [ITEM],
      );
      return Number(res.rows[0].n);
    });
    expect(out).toBe(0);
  });
});

describeWithDb("« Confier au chantier » (D141)", () => {
  const PLANNED = "00000000-0000-0000-0000-000000002a03";

  it("shows on the point who has it and for when, and the queue lists the point once", async () => {
    const out = await as(OWNER, async (c) => {
      // The seeded point is « ok »; make it late so it sits in the queue by itself.
      await c.query("set local role service_role");
      await c.query(
        "update public.checklist_completions set completed_at = current_date - interval '14 months' where checklist_item_id = $1",
        [ITEM],
      );
      await c.query("set local role authenticated");
      const before = await c.query(
        "select kind, title from public.boat_todo_queue($1::uuid, 20) where title = 'Vidange huile moteur — Moteur'",
        [BOAT],
      );
      await c.query(
        `insert into public.maintenance_logs (id, boat_id, title, category_id, status, performed_at, contact_id, checklist_item_id, created_by)
         values ($1, $2, 'Vidange huile moteur — Moteur', $3, 'planned', current_date + 10, $4, $5, $6)`,
        [PLANNED, BOAT, CATEGORY, YARD, ITEM, OWNER.id],
      );
      const view = await c.query(
        "select status::text, open_log_id, open_log_status::text, open_log_contact_name, to_char(open_log_at, 'YYYY-MM-DD') = to_char(current_date + 10, 'YYYY-MM-DD') as at_ok from public.checklist_item_status where id = $1",
        [ITEM],
      );
      const after = await c.query(
        "select kind, title from public.boat_todo_queue($1::uuid, 20) where title = 'Vidange huile moteur — Moteur'",
        [BOAT],
      );
      return { before: before.rows, view: view.rows[0], after: after.rows };
    });
    expect(out.before).toEqual([{ kind: "item", title: "Vidange huile moteur — Moteur" }]);
    expect(out.view).toEqual({
      status: "overdue",
      open_log_id: PLANNED,
      open_log_status: "planned",
      open_log_contact_name: "Chantier test",
      at_ok: true,
    });
    // The planned line is carried by the point's own row: one line for one job.
    expect(out.after).toEqual([{ kind: "item", title: "Vidange huile moteur — Moteur" }]);
  });

  it("lists the planned line itself when its point is not due", async () => {
    const rows = await as(OWNER, async (c) => {
      await c.query(
        `insert into public.maintenance_logs (id, boat_id, title, category_id, status, performed_at, contact_id, checklist_item_id, created_by)
         values ($1, $2, 'Vidange huile moteur — Moteur', $3, 'planned', current_date + 10, $4, $5, $6)`,
        [PLANNED, BOAT, CATEGORY, YARD, ITEM, OWNER.id],
      );
      const res = await c.query(
        "select rank, kind from public.boat_todo_queue($1::uuid, 20) where id = $2",
        [BOAT, PLANNED],
      );
      return res.rows;
    });
    expect(rows).toEqual([{ rank: 3, kind: "log" }]);
  });

  it("when the yard does the job, the point is ticked in its name", async () => {
    const out = await as(OWNER, async (c) => {
      await insertLog(c, OWNER, {
        id: PLANNED,
        status: "planned",
        performedAt: "2026-10-12",
        contactId: YARD,
      });
      await c.query(
        "update public.maintenance_logs set status = 'done', performed_at = current_date where id = $1",
        [PLANNED],
      );
      await insertReading(c, OWNER, PLANNED, 720, new Date().toISOString().slice(0, 10));
      const completion = await completionsOf(c, PLANNED);
      const view = await c.query(
        "select open_log_id, last_completed_by_name, last_engine_hours::float8 as hours from public.checklist_item_status where id = $1",
        [ITEM],
      );
      return { completion, view: view.rows[0] };
    });
    expect(out.completion).toMatchObject([
      { engine_hours: 720, completed_by_name: "Chantier test" },
    ]);
    expect(out.view).toEqual({
      open_log_id: null,
      last_completed_by_name: "Chantier test",
      hours: 720,
    });
  });

  it("a viewer reads the hand-over but cannot write one; a stranger reads nothing", async () => {
    const viewer = await as(VIEWER, async (c) => {
      try {
        await insertLog(c, VIEWER, { id: PLANNED, status: "planned", performedAt: "2026-10-12" });
        return "written";
      } catch (e) {
        return (e as { code?: string }).code ?? "";
      }
    });
    expect(viewer).toBe("42501");
    const stranger = await as(STRANGER, async (c) => {
      const res = await c.query(
        "select count(*)::int as n from public.checklist_item_status where boat_id = $1",
        [BOAT],
      );
      return Number(res.rows[0].n);
    });
    expect(stranger).toBe(0);
  });
});

describeWithDb("the derivation is the database's alone (0043)", () => {
  it("cannot be called by a signed-in user through RPC, yet fires for them as a trigger", async () => {
    const out = await as(PRO, async (c) => {
      const grants = await c.query(
        `select has_function_privilege('public.sync_log_completion(uuid)', 'execute') as sync,
                has_function_privilege('public.sync_log_completion_from_log()', 'execute') as from_log,
                has_function_privilege('public.sync_log_completion_from_reading()', 'execute') as from_reading,
                has_function_privilege('public.maintenance_logs_check_item_boat()', 'execute') as boat_check`,
      );
      // The trigger runs whatever the caller may execute: the pro's own tick still ticks.
      await insertLog(c, PRO, { id: LOG, status: "done", performedAt: "2026-09-10" });
      await insertReading(c, PRO, LOG, 700, "2026-09-10");
      return { grants: grants.rows[0], ticked: (await completionsOf(c, LOG)).length };
    });
    expect(out.grants).toEqual({
      sync: false,
      from_log: false,
      from_reading: false,
      boat_check: false,
    });
    expect(out.ticked).toBe(1);
  });
});

describeWithDb("the feed says a fact once (D140)", () => {
  it("does not repeat as a completion what an intervention already tells", async () => {
    const kinds = await as(OWNER, async (c) => {
      await insertLog(c, OWNER, { id: LOG, status: "done", performedAt: "2026-09-10" });
      await insertReading(c, OWNER, LOG, 700, "2026-09-10");
      const res = await c.query(
        "select kind from public.boat_activity where boat_id = $1 and happened_at = '2026-09-10' order by kind",
        [BOAT],
      );
      return res.rows.map((r) => (r as { kind: string }).kind);
    });
    expect(kinds).toEqual(["log"]);
  });

  it("still tells a completion that has no intervention behind it", async () => {
    const kinds = await as(OWNER, async (c) => {
      await c.query(
        `insert into public.checklist_completions (boat_id, checklist_item_id, completed_at, engine_hours, created_by)
         values ($1, $2, '2026-09-11', 710, $3)`,
        [BOAT, ITEM, OWNER.id],
      );
      const res = await c.query(
        "select kind from public.boat_activity where boat_id = $1 and happened_at = '2026-09-11'",
        [BOAT],
      );
      return res.rows.map((r) => (r as { kind: string }).kind);
    });
    expect(kinds).toEqual(["completion"]);
  });
});
