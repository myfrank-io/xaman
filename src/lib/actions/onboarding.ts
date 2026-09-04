"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { todayString } from "@/lib/format";
import { finishOnboardingSchema } from "@/lib/schemas/onboarding";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

/**
 * « Ouvrir mon carnet » — the last tap of the three-step onboarding (D67).
 *
 * One action rather than two calls from the browser, because what it writes is one answer: the
 * plan gives the boat its points, the counters give the hour-based ones a reference, and a carnet
 * that got the first without the second announces deadlines it cannot compute (D1).
 *
 * Not a transaction, and it does not need to be. `apply_checklist_template` is idempotent on
 * `(boat_id, external_ref)` and each reading is upserted on an id drawn when the step opened, so
 * a failure halfway is recovered by tapping again — nothing is written twice.
 *
 * The plan is applied **only when the boat has none**. Applying a second model is additive, never
 * a replacement, so a resumed step 3 on a boat that already chose its plan must not quietly pile
 * seventy more points on top of it.
 */
export async function finishOnboarding(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(finishOnboardingSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, templateId, readings } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  if (templateId) {
    const { data: boat, error: readError } = await supabase
      .from("boats")
      .select("checklist_template_id")
      .eq("id", boatId)
      .maybeSingle();
    if (readError) return fail(dbErrorKey(readError));
    // RLS hides a boat this person is not a member of, so « no row » is a refusal, not a 404.
    if (!boat) return fail("errors.forbidden");

    if (!boat.checklist_template_id) {
      const { error } = await supabase.rpc("apply_checklist_template", {
        p_boat_id: boatId,
        p_template_id: templateId,
      });
      if (error) return fail(dbErrorKey(error));
    }
  }

  if (readings.length > 0) {
    const readAt = todayString();
    const { error } = await supabase.from("engine_hour_readings").upsert(
      readings.map((reading) => ({
        id: reading.id,
        boat_id: boatId,
        engine_id: reading.engineId,
        hours: reading.hours,
        read_at: readAt,
        source: "manual" as const,
        created_by: userId,
        updated_by: userId,
      })),
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) return fail(dbErrorKey(error));
  }

  // The plan changes the checklist, the queue, the progress of every system and the dashboard.
  revalidatePath(`/boats/${boatId}`, "layout");
  return ok(undefined);
}
