import type { APIRequestContext } from "@playwright/test";

import { SEED, SERVICE_ROLE_KEY, SUPABASE_URL } from "./stack";

/** Fixed in supabase/seed.sql, like every other id these journeys lean on. */
const STRANGER_ID = "00000000-0000-0000-0000-000000000015";

function headers() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

/**
 * D151: access is granted the moment an owner invites — there is no pending row left to accept,
 * so the journey only needs a clean slate to invite into. The seed's `stranger@test.xaman` has
 * an account but no boat anywhere, so inviting them generates a fresh password (the same branch
 * a brand-new address takes) and the journey runs exactly the same way twice.
 */
export async function clearStrangerAccess(request: APIRequestContext): Promise<void> {
  const response = await request.delete(
    `${SUPABASE_URL}/rest/v1/boat_members?boat_id=eq.${SEED.boat}&user_id=eq.${STRANGER_ID}`,
    { headers: headers() },
  );
  if (!response.ok() && response.status() !== 404) {
    throw new Error(
      `could not clear stranger's access: ${response.status()} ${await response.text()}`,
    );
  }
}
