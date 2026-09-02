"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { submitReviewSchema } from "@/lib/schemas/logs";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

export type ReviewSummary = { logs: number; readings: number; purchases: number };

/**
 * « Reprise du carnet » (E3-7, D24): validates the imported rows in one go.
 *
 * For every line: the corrected date is written first (the `sync_log_readings_date` trigger
 * follows), then `mark_log_reviewed(log, override)` turns the kept hours into readings dated
 * from the line and clears `pending_engine_hours`. An engine left out of the override — an
 * emptied field or « ignorer » — creates no reading, which is exactly the contract of the
 * function: `coalesce(p_hours_override, pending, '{}')`, so an empty object ignores the line's
 * hours entirely without touching the rest.
 */
export async function submitReview(input: unknown): Promise<ActionResult<ReviewSummary>> {
  const parsed = parseInput(submitReviewSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, logs, purchases } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const summary: ReviewSummary = { logs: 0, readings: 0, purchases: 0 };

  for (const entry of logs) {
    const { data: current, error: readError } = await supabase
      .from("maintenance_logs")
      .select("id, performed_at")
      .eq("id", entry.logId)
      .eq("boat_id", boatId)
      .maybeSingle();
    if (readError) return fail(dbErrorKey(readError));
    if (!current) return fail("errors.log_not_found");

    if (current.performed_at !== entry.performedAt) {
      const { error: dateError, count } = await supabase
        .from("maintenance_logs")
        .update({ performed_at: entry.performedAt, updated_by: userId }, { count: "exact" })
        .eq("id", entry.logId)
        .eq("boat_id", boatId);
      if (dateError) return fail(dbErrorKey(dateError));
      if (!count) return fail("errors.forbidden");
    }

    const override: Record<string, number> = {};
    for (const hour of entry.hours) {
      if (hour.hours !== null) override[hour.engineId] = hour.hours;
    }

    const { error: rpcError } = await supabase.rpc("mark_log_reviewed", {
      p_log_id: entry.logId,
      p_hours_override: override,
    });
    if (rpcError) return fail(dbErrorKey(rpcError));

    summary.logs += 1;
    summary.readings += Object.keys(override).length;
  }

  for (const entry of purchases) {
    const { error, count } = await supabase
      .from("purchases")
      .update(
        {
          purchased_at: entry.purchasedAt,
          designation: entry.designation,
          amount: entry.amount,
          needs_review: false,
          updated_by: userId,
        },
        { count: "exact" },
      )
      .eq("id", entry.purchaseId)
      .eq("boat_id", boatId);
    if (error) return fail(dbErrorKey(error));
    if (!count) return fail("errors.forbidden");
    summary.purchases += 1;
  }

  revalidatePath(`/boats/${boatId}`, "layout");
  return ok(summary);
}
