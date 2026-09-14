import { expect, test } from "@playwright/test";

import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { SEED, hasStack, skipReason } from "../support/stack";
import { TapCounter } from "../support/taps";

/**
 * SPEC.md §6.3 — « Check printanier des voiles », the navigation the whole 4-tab layout exists
 * to serve: checklist → a system → the thing → done.
 *
 * The budget was three taps, and the refonte (E20-2) spends **one**: the date is today, the
 * person is whoever is signed in, and the hours are the engine's current counter — none of the
 * three is asked, all three are said back in the toast, and « Annuler » undoes it. The seeded
 * point counts engine hours **and** its engine has a reading, which is precisely the case the
 * old dialog made the most expensive and the new tick makes free.
 */
test.describe("§6.3 spring check", () => {
  test.skip(!hasStack, skipReason);

  test("ticks a checklist point within the tap budget", async ({ page, request }) => {
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/checklist`);
    await expect(page.getByRole("link", { name: new RegExp(SEED.category) }).first()).toBeVisible();

    // Reaching the system is navigation, not the act of ticking: the budget is the tick itself.
    await page
      .getByRole("link", { name: new RegExp(SEED.category) })
      .first()
      .tap();
    await expect(page.getByText(SEED.item).first()).toBeVisible();

    const taps = new TapCounter(page);

    // 1 — and only 1. The round check writes the completion: today, the signed-in member, and
    // the engine's current counter. No dialog opens, and nothing is typed.
    const tick = fr.checklist.tick.label.replace("{label}", SEED.item);
    await taps.tap(page.getByRole("button", { name: tick, exact: true }).first());
    await expect(page.getByRole("dialog")).toBeHidden();

    // What it wrote is read back rather than guessed at: the toast names the thing and carries
    // the undo, which is the whole safety of spending a single tap.
    await expect(
      page.getByText(new RegExp(fr.checklist.complete.saved.replace("{label}", ".*"))).first(),
    ).toBeVisible({ timeout: 15_000 });

    taps.expectWithin(1, "§6.3 cochage");
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
