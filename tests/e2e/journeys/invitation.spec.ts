import { expect, test } from "@playwright/test";

import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { hasStack, skipReason } from "../support/stack";

/**
 * SPEC.md §6.1 — "Première connexion d'Emmanuel (invité)". The invitation page has to say what
 * is being joined before asking anyone to sign in — the boat, who invited, which role — because
 * it is the first screen a new member ever sees.
 *
 * The seed carries one pending invitation (`supabase/seed.sql`): `stranger@test.xaman`, as
 * viewer, on the test boat.
 */
const TOKEN = "test-token-secret-000000000000000000000000001";
const INVITEE = "stranger@test.xaman";

test.describe("§6.1 an invitee's first sign-in", () => {
  test.skip(!hasStack, skipReason);

  test("the invitation names the boat, the inviter and the role before sign-in", async ({
    page,
  }) => {
    await page.goto(`/invite/${TOKEN}`);

    await expect(page.getByRole("heading", { name: fr.invite.title })).toBeVisible();
    await expect(page.getByText("Bateau test")).toBeVisible();
    // The invited address is shown so the person signs in with the right one.
    await expect(page.getByText(INVITEE)).toBeVisible();
  });

  test("an unknown token explains itself instead of failing", async ({ page }) => {
    await page.goto("/invite/not-a-real-token");
    await expect(page.getByText(fr.invite.invalid.title)).toBeVisible();
  });

  test("signing in as the invitee joins the boat", async ({ page, request }) => {
    await signIn(page, request, INVITEE, `/invite/${TOKEN}`);

    await page.getByRole("button", { name: /Rejoindre/ }).tap();

    // Lands on the boat: the invitation is spent and the membership exists.
    await page.waitForURL(/\/boats\/[0-9a-f-]+/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: fr.dashboard.title })).toBeVisible();
  });
});
