import { readFileSync } from "node:fs";
import path from "node:path";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { computeChecklistStatus, type ChecklistStatus } from "@/lib/checklist-status";

type Case = {
  name: string;
  today: string;
  anchorDate: string | null;
  anchorHours: number | null;
  lastCompletedAt: string | null;
  lastEngineHours: number | null;
  intervalMonths: number | null;
  intervalHours: number | null;
  currentHours: number | null;
  fixedDueAt: string | null;
  counterResetAt: string | null;
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

// The pure function takes the reference already resolved, exactly like the view does. The two
// `coalesce` below are copied from public.checklist_item_status (0004_tracking.sql) on purpose:
// they are what turns an item row into the function's arguments (anchoring D1, counter reset D12).
const SQL = `
  with input as (
    select $1::date as anchor_date, $2::numeric as anchor_hours, $3::date as last_completed_at,
           $4::numeric as last_engine_hours, $5::int as interval_months, $6::int as interval_hours,
           $7::numeric as current_hours, $8::date as fixed_due_at, $9::date as counter_reset_at,
           $10::date as today
  ),
  resolved as (
    select
      coalesce(i.last_completed_at, i.anchor_date) as reference_at,
      case
        when i.counter_reset_at is not null
             and coalesce(i.last_completed_at, i.anchor_date) < i.counter_reset_at then null
        else coalesce(i.last_engine_hours, i.anchor_hours)
      end as reference_hours,
      (i.last_completed_at is not null) as has_completion,
      i.interval_months, i.interval_hours, i.current_hours, i.fixed_due_at, i.today
    from input i
  )
  select s.due_at::text, s.due_hours::float8, s.days_remaining,
         s.hours_remaining::float8, s.status::text
  from resolved r
  cross join lateral public.checklist_compute_status(
    r.reference_at, r.interval_months, r.reference_hours, r.interval_hours,
    r.current_hours, r.has_completion, r.fixed_due_at, r.today
  ) s
`;

describe("checklist status — SQL function (parity with the fixture)", () => {
  it.each(cases)("$name", async (c) => {
    const res = await pool.query(SQL, [
      c.anchorDate,
      c.anchorHours,
      c.lastCompletedAt,
      c.lastEngineHours,
      c.intervalMonths,
      c.intervalHours,
      c.currentHours,
      c.fixedDueAt,
      c.counterResetAt,
      c.today,
    ]);
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
