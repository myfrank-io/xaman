import type { APIRequestContext, Page } from "@playwright/test";

import { SERVICE_ROLE_KEY, SUPABASE_URL } from "./stack";

/**
 * Sign a seeded user in, through the app's own code path.
 *
 * The Auth admin API mints a one-time token for an existing user (`generate_link`), and the
 * app's `/auth/callback` route already knows how to spend one: it is the magic-link fallback,
 * `token_hash` + `type`. So the session is established by the same route a real magic link
 * uses, cookies and all — no password in the seed, no hand-built cookie, nothing mocked.
 *
 * `generate_link` does not send an e-mail, which is what makes it usable from a test.
 */
export async function signIn(
  page: Page,
  request: APIRequestContext,
  email: string,
  next = "/boats",
): Promise<void> {
  const response = await request.post(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    data: { type: "magiclink", email },
  });

  if (!response.ok()) {
    throw new Error(
      `generate_link failed for ${email}: ${response.status()} ${await response.text()}`,
    );
  }

  const { hashed_token: hashedToken } = (await response.json()) as { hashed_token?: string };
  if (!hashedToken) throw new Error(`generate_link returned no hashed_token for ${email}`);

  const callback = `/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=${encodeURIComponent(next)}`;
  await page.goto(callback);
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/callback"));

  if (page.url().includes("/login")) {
    throw new Error(`sign-in for ${email} bounced back to /login`);
  }
}
