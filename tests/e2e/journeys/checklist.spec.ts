import { expect, test } from "@playwright/test";

import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { SEED, hasStack, skipReason } from "../support/stack";
import { TapCounter } from "../support/taps";

/**
 * SPEC.md §6.3 — "Check printanier des voiles", the navigation that the whole 4-tab layout
 * exists to serve: dashboard → a category → a point → done. The budget for ticking a point is
 * three taps (E9-3).
 */
test.describe("§6.3 spring check", () => {
  test.skip(!hasStack, skipReason);

  test("ticks a checklist point within the tap budget", async ({ page, request }) => {
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/checklist`);
    await expect(page.getByRole("link", { name: new RegExp(SEED.category) }).first()).toBeVisible();

    const taps = new TapCounter(page);

    // 1 — a category card.
    await taps.tap(page.getByRole("link", { name: new RegExp(SEED.category) }).first());

    // 2 — "Fait" on the point, which opens the dialog (date, who, note).
    await taps.tap(page.getByRole("button", { name: fr.checklist.markDone }).first());

    // 3 — confirm. The dialog opens on today and on the signed-in member.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await taps.tap(dialog.getByRole("button", { name: fr.common.save }));

    await expect(dialog).toBeHidden({ timeout: 15_000 });

    taps.expectWithin(3, "§6.3 cochage");
  });

  test("adds a point to the boat's own checklist", async ({ page, request }) => {
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/checklist`);

    await page
      .getByRole("link", { name: /Moteurs/ })
      .first()
      .tap();
    await page.getByRole("button", { name: fr.checklist.addItem }).first().tap();

    const label = `Drisse hookée du Code 0 ${Date.now()}`;
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").first().fill(label);
    await dialog.getByRole("button", { name: fr.common.save }).tap();

    await expect(page.getByText(label).first()).toBeVisible({ timeout: 15_000 });
  });
});
