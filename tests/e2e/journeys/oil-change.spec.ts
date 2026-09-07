import { expect, test } from "@playwright/test";

import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { SEED, hasStack, skipReason } from "../support/stack";
import { TapCounter } from "../support/taps";

/**
 * SPEC.md §6.2 — "Vidange à quai (moins d'une minute)".
 *
 * The journey that decides whether the app is usable at all: Xavier, at the dock, notes an oil
 * change. The budget is seven taps (E9-3); the point of measuring it here is that a screen
 * cannot quietly grow an eighth.
 */
test.describe("§6.2 oil change at the dock", () => {
  test.skip(!hasStack, skipReason);

  test("notes an intervention within the tap budget", async ({ page, request }) => {
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/dashboard`);
    await expect(
      page.getByRole("heading", { name: SEED.boatName, level: 1 }).first(),
    ).toBeVisible();

    const taps = new TapCounter(page);

    // 1 — the one primary action of the screen opens the intervention form.
    await taps.tap(page.getByRole("link", { name: fr.create.primary }).first());
    await expect(page.getByLabel(fr.logs.form.title)).toBeVisible();

    // Typing is not a tap: the field is already focused by the tap that opened the form.
    await page.getByLabel(fr.logs.form.title).fill("Vidange moteur SB");

    // 2 — the category, as a chip rather than a select (rule 13).
    await taps.tap(page.getByRole("radio", { name: SEED.category }).first());

    // 3 — save. Date, status and engine hours are already carrying their defaults.
    await taps.tap(page.getByRole("button", { name: fr.common.save }));

    // The intervention is at the head of the log, which is where §6.2 ends.
    await expect(page.getByText("Vidange moteur SB").first()).toBeVisible({ timeout: 15_000 });

    taps.expectWithin(7, "§6.2 vidange");
  });
});
