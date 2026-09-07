import type { APIRequestContext } from "@playwright/test";

import { SERVICE_ROLE_KEY, SUPABASE_URL } from "./stack";

/** Every boat this journey opens is named with it, so cleanup can find them and nothing else. */
export const E2E_BOAT_PREFIX = "E2E carnet";

/**
 * The first-launch journey opens a real carnet, and a carnet is not spent the way an invitation
 * is — it simply stays. Two devices means two boats per run, and a stack that is not reset
 * between runs would collect them.
 *
 * So the journey clears its own leavings first, matching on the name it gives them. `on delete
 * cascade` from `boats` takes the members, categories, engines and checklist items with it.
 */
export async function removeE2EBoats(request: APIRequestContext): Promise<void> {
  const response = await request.delete(
    `${SUPABASE_URL}/rest/v1/boats?name=like.${encodeURIComponent(`${E2E_BOAT_PREFIX}%`)}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok()) {
    throw new Error(`could not clear E2E boats: ${response.status()} ${await response.text()}`);
  }
}
