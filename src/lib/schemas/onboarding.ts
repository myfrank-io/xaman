import { z } from "zod";

import { NEW_BOAT_ENGINES_MAX } from "@/lib/schemas/boat";
import { decimal, uuid } from "@/lib/schemas/common";
import { ENGINE_HOURS_MAX } from "@/lib/schemas/engines";

/**
 * The last tap of the onboarding (D67): « Ouvrir mon carnet ».
 *
 * Step 3 explains how the app works *by setting it up* — the maintenance plan and the engine
 * counters are the two things without which a carnet cannot say anything true — so the button
 * that closes the flow carries both answers at once.
 *
 * Both are optional, and that is deliberate rather than lax: a plan can be chosen later from the
 * Checklist screen, a counter from the Bateau screen, and neither is worth blocking someone who
 * simply wants to see their carnet.
 */
export const finishOnboardingSchema = z.object({
  boatId: uuid,
  /** The plan to apply, or null to decide later. */
  templateId: uuid.nullable().default(null),
  readings: z
    .array(
      z.object({
        // Drawn when step 3 opens, so a double tap writes one reading (rule 11).
        id: uuid,
        engineId: uuid,
        hours: decimal({ scale: 1, max: ENGINE_HOURS_MAX }),
      }),
    )
    .max(NEW_BOAT_ENGINES_MAX)
    .default([]),
});
export type FinishOnboardingInput = z.input<typeof finishOnboardingSchema>;
