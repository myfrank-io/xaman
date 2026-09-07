import type { APIRequestContext } from "@playwright/test";

import { SEED, SERVICE_ROLE_KEY, SUPABASE_URL } from "./stack";

/** Fixed in supabase/seed.sql, like every other id these journeys lean on. */
const STRANGER_ID = "00000000-0000-0000-0000-000000000015";
const OWNER_ID = "00000000-0000-0000-0000-000000000011";

function headers() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

/**
 * An invitation is spent when it is accepted, so the one in the seed survives exactly one run
 * of §6.1 — and the journeys run twice, once per device. The first run passed and the second
 * found a boat it had already joined, which read as a broken selector and was really a broken
 * fixture.
 *
 * So the journey makes its own: the membership and any earlier invitation are cleared, then a
 * fresh pending invitation is issued. The test is then repeatable, and independent of whether
 * the other device ran first.
 */
export async function freshInvitation(request: APIRequestContext): Promise<string> {
  const token = `e2e-token-${crypto.randomUUID()}`;
  const email = SEED.users.stranger;

  // Order matters: the membership goes first, or accepting again is a no-op on a member.
  await request.delete(
    `${SUPABASE_URL}/rest/v1/boat_members?boat_id=eq.${SEED.boat}&user_id=eq.${STRANGER_ID}`,
    { headers: headers() },
  );
  await request.delete(
    `${SUPABASE_URL}/rest/v1/boat_invitations?boat_id=eq.${SEED.boat}&email=eq.${email}`,
    { headers: headers() },
  );

  const response = await request.post(`${SUPABASE_URL}/rest/v1/boat_invitations`, {
    headers: { ...headers(), Prefer: "return=minimal" },
    data: { boat_id: SEED.boat, email, role: "viewer", token, invited_by: OWNER_ID },
  });
  if (!response.ok()) {
    throw new Error(`could not issue an invitation: ${response.status()} ${await response.text()}`);
  }
  return token;
}
