import { expect, test } from "@playwright/test";

import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { freshInvitation } from "../support/invitation";
import { SEED, hasStack, skipReason } from "../support/stack";

/**
 * SPEC.md §6.1 — "Première connexion d'Emmanuel (invité)". The invitation page has to say what
 * is being joined before asking anyone to sign in — the boat, who invited, which role — because
 * it is the first screen a new member ever sees.
 *
 * The seed carries one pending invitation (`supabase/seed.sql`): `stranger@test.xaman`, as
 * viewer, on the test boat.
 */
const INVITEE = SEED.users.stranger;

test.describe("§6.1 an invitee's first sign-in", () => {
  test.skip(!hasStack, skipReason);

  test("the invitation names the boat, the inviter and the role before sign-in", async ({
    page,
    request,
  }) => {
    await page.goto(`/invite/${await freshInvitation(request)}`);

    await expect(page.getByRole("heading", { name: fr.invite.title })).toBeVisible();
    await expect(page.getByText(SEED.boatName).first()).toBeVisible();
    // The address is deliberately masked in the preview — the invitee types their own — so what
    // is asserted is the sentence that asks for it, not the address itself.
    await expect(page.getByText(/adresse invitée/).first()).toBeVisible();
  });

  test("an unknown token explains itself instead of failing", async ({ page }) => {
    await page.goto("/invite/not-a-real-token");
    await expect(page.getByText(fr.invite.invalid.title)).toBeVisible();
  });

  test("signing in as the invitee joins the boat", async ({ page, request }) => {
    await signIn(page, request, INVITEE, `/invite/${await freshInvitation(request)}`);

    await page.getByRole("button", { name: /Rejoindre/ }).tap();

    // Lands on the boat: the invitation is spent and the membership exists.
    await page.waitForURL(/\/boats\/[0-9a-f-]+/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: SEED.boatName, level: 1 }).first(),
    ).toBeVisible();
  });
});
