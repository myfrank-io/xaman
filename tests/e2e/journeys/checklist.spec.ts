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

    // Reaching the category is navigation, not the act of ticking: the budget of three is the
    // ticking itself, and CompleteItemDialog states the same shape — "2 taps without hours, 3
    // with". The seeded point counts engine hours, so this is the three-tap case.
    await page
      .getByRole("link", { name: new RegExp(SEED.category) })
      .first()
      .tap();
    await expect(page.getByText(SEED.item).first()).toBeVisible();

    const taps = new TapCounter(page);

    // 1 — "Fait" on the row opens the dialog, already on today and on the signed-in member.
    await taps.tap(
      // "Fait" is a substring of the "Jamais fait" filter, and Playwright matches an
      // accessible name by substring unless told otherwise — without exact, .first()
      // taps the filter chip and no dialog ever opens.
      page.getByRole("button", { name: fr.checklist.markDone, exact: true }).first(),
    );
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Hours are required for an item that counts them (zod + a database trigger). Typing into
    // the field the dialog already opened is not a tap.
    await dialog
      .getByLabel(new RegExp(fr.checklist.complete.hours.replace("{engine}", ".*")))
      .fill("700");

    // 2 — confirm.
    await taps.tap(dialog.getByRole("button", { name: fr.common.save, exact: true }));
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    taps.expectWithin(3, "§6.3 cochage");
  });

  test("adds a point to the boat's own checklist", async ({ page, request }) => {
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/checklist`);

    // "Ajouter un point" is a link to its own screen, not a dialog: the form carries steps,
    // an interval and an engine, which is more than a sheet should hold.
    await page.getByRole("link", { name: fr.checklist.addItem }).first().tap();

    const label = `Drisse hookée du Code 0 ${Date.now()}`;
    await page.getByLabel(fr.checklist.form.label).fill(label);
    // A point belongs to a category, and the form opened from the checklist itself carries
    // none: the chips are how one is chosen (rule 13).
    await page.getByRole("radio", { name: SEED.category }).first().tap();
    await page.getByRole("button", { name: fr.common.save, exact: true }).tap();

    // §6.3 ends on the point being there for the next person to see.
    await expect(page.getByText(label).first()).toBeVisible({ timeout: 15_000 });
  });
});
