import { expect, test } from "@playwright/test";

import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { clearStrangerAccess } from "../support/invitation";
import { SEED, hasStack, skipReason } from "../support/stack";

/**
 * SPEC.md §6.1 — a new member's first sign-in. D151 replaced the invitation link and the 6-digit
 * code with an immediate grant: the owner invites from the Membres screen, the account and the
 * access exist right away, and the invitee's only step is to sign in. Without a mailer configured
 * (this stack has none), the dialog shows the generated password itself — the owner's fallback
 * for a message that did not leave (`src/components/members/InviteMemberDialog.tsx`) — which is
 * also what lets this journey read the password back without an inbox to check.
 */
const INVITEE = SEED.users.stranger;

test.describe("§6.1 a new member's first sign-in", () => {
  test.skip(!hasStack, skipReason);

  test("inviting grants access right away and hands back a password to relay", async ({
    page,
    request,
  }) => {
    await clearStrangerAccess(request);
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/members`);

    await page.getByRole("button", { name: fr.members.invite.button }).click();
    await page.getByLabel(fr.members.invite.email).fill(INVITEE);
    await page.getByRole("button", { name: fr.members.invite.submit }).click();

    // No mailer in this stack: the dialog falls back to the password, exactly as it does for an
    // owner whose mailer is having a bad day.
    await expect(page.getByText(fr.members.invite.emailFailedTitle)).toBeVisible();
    const password = await page.locator("input[readonly]").inputValue();
    expect(password.length).toBeGreaterThanOrEqual(8);

    await page.getByRole("button", { name: fr.common.close }).click();
    await page.getByRole("button", { name: fr.nav.signOut }).click();

    await page.goto("/login");
    await page.getByLabel(fr.auth.email.label).fill(INVITEE);
    await page.getByLabel(fr.auth.password.label).fill(password);
    await page.getByRole("button", { name: fr.auth.password.submit }).click();

    await page.waitForURL(/\/boats\/[0-9a-f-]+/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: SEED.boatName, level: 1 }).first(),
    ).toBeVisible();
  });
});
