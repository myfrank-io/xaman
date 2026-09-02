import path from "node:path";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runSeed, type SeedReport } from "../../scripts/seed.mts";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
const seedDir = path.resolve(import.meta.dirname, "../../seed");

const TABLES = [
  "checklist_templates",
  "checklist_template_categories",
  "checklist_template_items",
  "boats",
  "boat_members",
  "engines",
  "boat_categories",
  "checklist_items",
  "equipment",
  "contacts",
  "maintenance_logs",
  "engine_hour_readings",
  "purchases",
] as const;

async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) {
    const res = await pool.query(`select count(*)::int as n from public.${t}`);
    out[t] = Number(res.rows[0]?.n);
  }
  return out;
}

let first: SeedReport;
let afterFirst: Record<string, number>;
let afterSecond: Record<string, number>;

beforeAll(async () => {
  first = await runSeed(pool, { seedDir, auth: null });
  afterFirst = await counts();
  await runSeed(pool, { seedDir, auth: null });
  afterSecond = await counts();
});

afterAll(async () => {
  // leave the database as the RLS suite expects it (supabase/seed.sql only)
  await pool.query("delete from public.boats where external_ref = 'xaman'");
  await pool.query("delete from public.checklist_templates where external_ref = 'orc50-v1'");
  await pool.query("delete from auth.users where email not like '%@test.xaman'");
  await pool.end();
});

describe("pnpm seed:xaman", () => {
  it("loads the Xaman boat, its checklist and history", () => {
    expect(first.template_categories).toBe(8);
    expect(first.template_items).toBeGreaterThan(80);
    expect(first.boat_categories).toBeGreaterThanOrEqual(8);
    expect(first.engines).toBe(3);
    expect(first.members).toBe(3);
    expect(first.maintenance_logs).toBe(7);
    expect(first.purchases).toBe(3);
  });

  it("duplicates per-engine template items (inboard → 2 Yanmar, outboard → 1 Suzuki)", async () => {
    const res = await pool.query(
      `select count(*)::int as n from public.checklist_items i join public.boats b on b.id = i.boat_id
       where b.external_ref = 'xaman' and i.external_ref like 'eng-oil:%'`,
    );
    expect(Number(res.rows[0]?.n)).toBe(2);
    const outboard = await pool.query(
      `select count(*)::int as n from public.checklist_items i join public.boats b on b.id = i.boat_id
       where b.external_ref = 'xaman' and i.external_ref like 'eng-outboard-service:%'`,
    );
    expect(Number(outboard.rows[0]?.n)).toBe(1);
  });

  it("imports paper-log lines with pending hours and no readings", async () => {
    const res = await pool.query(
      `select count(*) filter (where needs_review)::int as review,
              count(*) filter (where pending_engine_hours is not null)::int as pending
       from public.maintenance_logs l join public.boats b on b.id = l.boat_id where b.external_ref = 'xaman'`,
    );
    expect(res.rows[0]).toEqual({ review: 7, pending: 7 });
    const readings = await pool.query(
      `select count(*)::int as n from public.engine_hour_readings r join public.boats b on b.id = r.boat_id where b.external_ref = 'xaman'`,
    );
    expect(Number(readings.rows[0]?.n)).toBe(0);
  });

  it("is idempotent: a second run leaves every table unchanged", () => {
    expect(afterSecond).toEqual(afterFirst);
  });
});
