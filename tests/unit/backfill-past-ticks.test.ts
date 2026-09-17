/**
 * Migration 0044 — the ticks that came before D140 become interventions too.
 *
 * Runs against a Postgres that has the migrations + supabase/seed.sql applied, like
 * `checklist-journal.test.ts`: DATABASE_URL, or the suite skips itself. Each case opens a
 * transaction, plants the ticks a carnet had before 0042, replays **the migration file itself**
 * (its body, the surrounding begin/commit aside — this is the shipped SQL, not a copy of it),
 * and rolls the whole thing back.
 *
 * What is proven here is the one thing a data migration owes: it writes the missing half of the
 * story without touching the half that was already there.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

const BOAT = "00000000-0000-0000-0000-00000000b001";
const CATEGORY = "00000000-0000-0000-0000-00000000ca01";
const ENGINE = "00000000-0000-0000-0000-00000000e001";
const OWNER = "00000000-0000-0000-0000-000000000011";
/** Seeded hour-based point: 12 months / 250 h on ENGINE. */
const HOUR_ITEM = "00000000-0000-0000-0000-000000003001";
/** Seeded provider of the boat's directory: « Chantier test ». */
const YARD_NAME = "Chantier test";

/** Ids of this suite, kept away from the other files' (transactions are rolled back). */
const DATE_ITEM = "00000000-0000-0000-0000-0000000c4401";
const PLAIN = "00000000-0000-0000-0000-0000000c4410";
const HOURS = "00000000-0000-0000-0000-0000000c4420";
const NO_ENGINE_HOURS = "00000000-0000-0000-0000-0000000c4430";

/** The migration, without its transaction: the test already is one. */
const MIGRATION = readFileSync(
  resolve(__dirname, "../../supabase/migrations/0044_past_ticks_are_interventions.sql"),
  "utf8",
)
  .split("\n")
  .filter((line) => line.trim() !== "begin;" && line.trim() !== "commit;")
  .join("\n");

/** `pg` hands a `date` back as a Date; the day is what these cases are about. */
function day(value: unknown): string {
  return new Date(value as string).toISOString().slice(0, 10);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

afterAll(async () => {
  await pool.end();
});

/**
 * One rolled-back transaction, as the role a migration runs under (the connection's own, owner).
 * The point here is the data, not the policies: `rls.test.ts` holds those.
 */
async function inTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

/** A point without an engine — the winches, the liferaft, anything on a plain calendar. */
async function plantDateItem(c: PoolClient) {
  await c.query(
    `insert into public.checklist_items (id, boat_id, category_id, label, interval_months, sort_order, anchor_date)
     values ($1, $2, $3, 'Lubrification winches', 12, 90, '2026-01-01')`,
    [DATE_ITEM, BOAT, CATEGORY],
  );
}

type Tick = {
  id: string;
  itemId: string;
  completedAt: string;
  hours?: number;
  note?: string;
  byName?: string;
  createdAt?: string;
};

/** A tick as it was written before D140: a completion, and nothing in the journal. */
async function plantTick(c: PoolClient, tick: Tick) {
  await c.query(
    `insert into public.checklist_completions
       (id, boat_id, checklist_item_id, completed_at, engine_hours, note, completed_by_name,
        completed_by, created_by, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $8, coalesce($9::timestamptz, now()),
             coalesce($9::timestamptz, now()))`,
    [
      tick.id,
      BOAT,
      tick.itemId,
      tick.completedAt,
      tick.hours ?? null,
      tick.note ?? null,
      tick.byName ?? null,
      OWNER,
      tick.createdAt ?? null,
    ],
  );
}

async function migrate(c: PoolClient) {
  await c.query(MIGRATION);
}

describeWithDb("a tick from before D140 becomes the intervention it was (0044)", () => {
  it("writes the line the same tick would write today, and hands it the completion", async () => {
    const out = await inTx(async (c) => {
      await plantDateItem(c);
      await plantTick(c, {
        id: PLAIN,
        itemId: DATE_ITEM,
        completedAt: "2026-08-17",
        note: "Winch J1 : cliquet cassé remplacé",
        // Spelled as it was typed; the directory holds the same provider.
        byName: "  chantier TEST ",
        createdAt: "2026-08-17T10:00:00Z",
      });
      await migrate(c);

      const log = await c.query(
        `select l.title, l.status, l.performed_at, l.category_id, l.notes, l.checklist_item_id,
                l.created_at, l.deleted_at, c.name as contact_name,
                (select count(*)::int from public.maintenance_log_categories mlc
                  where mlc.log_id = l.id and mlc.category_id = l.category_id) as linked_category
           from public.maintenance_logs l
           left join public.contacts c on c.id = l.contact_id
          where l.id = $1`,
        [PLAIN],
      );
      const completion = await c.query(
        `select maintenance_log_id, completed_at, completed_by_name, completed_by, note
           from public.checklist_completions where id = $1`,
        [PLAIN],
      );
      return { log: log.rows[0], completion: completion.rows[0] };
    });

    // The intervention is the tick: same day, same system, same words, and the point on it.
    expect(out.log).toMatchObject({
      title: "Lubrification winches",
      status: "done",
      category_id: CATEGORY,
      notes: "Winch J1 : cliquet cassé remplacé",
      checklist_item_id: DATE_ITEM,
      deleted_at: null,
      linked_category: 1,
      // « Réalisé par » : the frozen name named a provider the directory knows.
      contact_name: YARD_NAME,
    });
    expect(day(out.log.performed_at)).toBe("2026-08-17");
    // The day the fact was recorded, not the day of the migration: the feed must not move.
    expect(day(out.log.created_at)).toBe("2026-08-17");
    // The completion is the same row, now derived from the line.
    expect(out.completion).toMatchObject({
      maintenance_log_id: PLAIN,
      completed_by: OWNER,
      note: "Winch J1 : cliquet cassé remplacé",
    });
  });

  it("moves the counter read to the intervention rather than doubling it", async () => {
    const out = await inTx(async (c) => {
      await plantTick(c, { id: HOURS, itemId: HOUR_ITEM, completedAt: "2026-07-01", hours: 690 });
      const before = await c.query(
        "select count(*)::int as n from public.engine_hour_readings where engine_id = $1 and read_at = '2026-07-01'",
        [ENGINE],
      );
      await migrate(c);
      const readings = await c.query(
        `select hours, source, maintenance_log_id, read_at
           from public.engine_hour_readings where engine_id = $1 and read_at = '2026-07-01'`,
        [ENGINE],
      );
      const completion = await c.query(
        "select maintenance_log_id, engine_hours from public.checklist_completions where id = $1",
        [HOURS],
      );
      const status = await c.query(
        `select last_completed_at, last_engine_hours
           from public.checklist_item_status where id = $1`,
        [HOUR_ITEM],
      );
      return {
        before: before.rows[0].n as number,
        readings: readings.rows,
        completion: completion.rows[0],
        status: status.rows[0],
      };
    });

    // The tick had written one reading; the migration hands it over, it does not add one.
    expect(out.before).toBe(1);
    expect(out.readings).toHaveLength(1);
    expect(out.readings[0]).toMatchObject({ source: "maintenance_log", maintenance_log_id: HOURS });
    expect(Number(out.readings[0].hours)).toBe(690);
    // The point is still ticked, at the same date and the same hours.
    expect(out.completion).toMatchObject({ maintenance_log_id: HOURS });
    expect(Number(out.completion.engine_hours)).toBe(690);
    expect(day(out.status.last_completed_at)).toBe("2026-07-01");
    expect(Number(out.status.last_engine_hours)).toBe(690);
  });

  it("writes the reading back when the tick lost it, rather than losing the tick", async () => {
    const out = await inTx(async (c) => {
      await plantTick(c, { id: HOURS, itemId: HOUR_ITEM, completedAt: "2026-07-02", hours: 705 });
      // An import, or a reading deleted since: the hours live on the completion alone.
      await c.query("delete from public.engine_hour_readings where checklist_completion_id = $1", [
        HOURS,
      ]);
      await migrate(c);
      const completion = await c.query(
        "select maintenance_log_id, engine_hours from public.checklist_completions where id = $1",
        [HOURS],
      );
      const reading = await c.query(
        "select hours, source from public.engine_hour_readings where maintenance_log_id = $1",
        [HOURS],
      );
      return { completion: completion.rows[0], reading: reading.rows[0] };
    });

    expect(out.completion).toMatchObject({ maintenance_log_id: HOURS });
    expect(Number(out.completion.engine_hours)).toBe(705);
    expect(out.reading).toMatchObject({ source: "maintenance_log" });
    expect(Number(out.reading.hours)).toBe(705);
  });

  it("leaves alone the hours an intervention could not carry", async () => {
    const out = await inTx(async (c) => {
      await plantDateItem(c);
      // Hours on a point that has no engine: the line has nowhere to put them.
      await plantTick(c, {
        id: NO_ENGINE_HOURS,
        itemId: DATE_ITEM,
        completedAt: "2026-06-01",
        hours: 42,
      });
      await migrate(c);
      const completion = await c.query(
        "select maintenance_log_id, engine_hours from public.checklist_completions where id = $1",
        [NO_ENGINE_HOURS],
      );
      const log = await c.query(
        "select count(*)::int as n from public.maintenance_logs where id = $1",
        [NO_ENGINE_HOURS],
      );
      return { completion: completion.rows[0], logs: log.rows[0].n as number };
    });

    expect(out.completion.maintenance_log_id).toBeNull();
    expect(Number(out.completion.engine_hours)).toBe(42);
    expect(out.logs).toBe(0);
  });

  it("says each fact once in the feed, and still says the ones it left alone", async () => {
    const kinds = await inTx(async (c) => {
      await plantDateItem(c);
      await plantTick(c, { id: PLAIN, itemId: DATE_ITEM, completedAt: "2026-08-17" });
      await plantTick(c, {
        id: NO_ENGINE_HOURS,
        itemId: DATE_ITEM,
        completedAt: "2026-06-01",
        hours: 42,
      });
      await migrate(c);
      const res = await c.query(
        `select happened_at, kind from public.boat_activity
          where boat_id = $1 and happened_at in ('2026-08-17', '2026-06-01')
          order by happened_at`,
        [BOAT],
      );
      return res.rows.map((r) => (r as { kind: string }).kind);
    });
    // The rescued tick is told by its intervention; the one left behind, by itself.
    expect(kinds).toEqual(["completion", "log"]);
  });

  it("writes nothing a second time, and nothing on a tick that already had its line", async () => {
    const out = await inTx(async (c) => {
      await plantDateItem(c);
      await plantTick(c, { id: PLAIN, itemId: DATE_ITEM, completedAt: "2026-08-17" });
      await migrate(c);
      const first = await c.query("select updated_at from public.maintenance_logs where id = $1", [
        PLAIN,
      ]);
      await migrate(c);
      const after = await c.query(
        `select (select count(*)::int from public.maintenance_logs where id = $1) as logs,
                (select count(*)::int from public.maintenance_log_categories where log_id = $1) as links,
                (select updated_at from public.maintenance_logs where id = $1) as updated_at`,
        [PLAIN],
      );
      return { first: first.rows[0].updated_at, after: after.rows[0] };
    });

    expect(out.after).toMatchObject({ logs: 1, links: 1 });
    expect(String(out.after.updated_at)).toBe(String(out.first));
  });
});
