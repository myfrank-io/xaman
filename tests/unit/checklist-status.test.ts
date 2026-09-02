import { readFileSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { computeChecklistStatus, type ChecklistStatus } from "@/lib/checklist-status";

type Case = {
  name: string;
  today: string;
  lastCompletedAt: string | null;
  intervalMonths: number | null;
  lastEngineHours: number | null;
  intervalHours: number | null;
  currentHours: number | null;
  expected: ChecklistStatus;
};

const cases = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../fixtures/checklist-status-cases.json"),
    "utf8",
  ),
) as Case[];

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

afterAll(async () => {
  await pool.end();
});

describe("checklist status — TypeScript mirror", () => {
  it.each(cases)("$name", (c) => {
    expect(computeChecklistStatus(c)).toEqual(c.expected);
  });
});

describe("checklist status — SQL function (parity with the fixture)", () => {
  it.each(cases)("$name", async (c) => {
    const res = await pool.query(
      `select due_at::text, due_hours::float8, days_remaining, hours_remaining::float8, status::text
       from public.checklist_compute_status($1::date, $2::int, $3::numeric, $4::int, $5::numeric, $6::date)`,
      [
        c.lastCompletedAt,
        c.intervalMonths,
        c.lastEngineHours,
        c.intervalHours,
        c.currentHours,
        c.today,
      ],
    );
    const row = res.rows[0] as {
      due_at: string | null;
      due_hours: number | null;
      days_remaining: number | null;
      hours_remaining: number | null;
      status: string;
    };
    expect({
      dueAt: row.due_at,
      dueHours: row.due_hours,
      daysRemaining: row.days_remaining,
      hoursRemaining: row.hours_remaining,
      state: row.status,
    }).toEqual(c.expected);
  });
});
