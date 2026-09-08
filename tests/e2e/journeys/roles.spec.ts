import { expect, test } from "@playwright/test";

import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { SEED, hasStack, skipReason } from "../support/stack";

/**
 * SPEC.md §6.4 — "Le mécano Yanmar monte à bord". The mechanic is a `pro`: he records his own
 * work and ticks what he did, and he neither deletes nor sees the members. The RLS matrix
 * already proves that in `tests/unit/rls.test.ts`; what this journey adds is that the UI agrees
 * with the database — a screen that offers a button the database will refuse is a bug even when
 * the row is safe.
 */
test.describe("§6.4 the mechanic comes aboard", () => {
  test.skip(!hasStack, skipReason);

  test("a pro reads the boat and records an intervention", async ({ page, request }) => {
    await signIn(page, request, SEED.users.pro, `/boats/${SEED.boat}/dashboard`);

    // He sees the boat: engine hours are the reason he is here.
    await expect(
      page.getByRole("heading", { name: SEED.boatName, level: 1 }).first(),
    ).toBeVisible();
    await expect(page.getByText(fr.dashboard.engines.title)).toBeVisible();

    // He records his own work.
    await page.goto(`/boats/${SEED.boat}/logs/new`);
    const title = `Révision Yanmar ${Date.now()}`;
    await page.getByLabel(fr.logs.form.title).fill(title);
    // The category is required, like it is for anyone else: a pro writes a whole row or none.
    await page.getByRole("radio", { name: SEED.category }).first().tap();
    await page.getByRole("button", { name: fr.common.save, exact: true }).tap();

    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  });

  test("a pro is not offered the members screen", async ({ page, request }) => {
    await signIn(page, request, SEED.users.pro, `/boats/${SEED.boat}/dashboard`);

    // Not in the account menu…
    await expect(page.getByRole("link", { name: fr.nav.members })).toHaveCount(0);

    // …and not by typing the address either: the guard is the page's, not the menu's.
    await page.goto(`/boats/${SEED.boat}/members`);
    await expect(page.getByRole("heading", { name: fr.members.title })).toHaveCount(0);
  });

  test("a viewer is offered no way to write", async ({ page, request }) => {
    await signIn(page, request, SEED.users.viewer, `/boats/${SEED.boat}/dashboard`);

    await expect(
      page.getByRole("heading", { name: SEED.boatName, level: 1 }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: fr.create.primary })).toHaveCount(0);
  });
});
