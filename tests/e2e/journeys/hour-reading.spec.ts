import { expect, test } from "@playwright/test";

import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { SEED, hasStack, skipReason } from "../support/stack";
import { TapCounter } from "../support/taps";

/**
 * The third interaction budget of E9-3, after the oil change and the tick: noting the engine
 * hours is three taps. It is the entry made most often and the one most often made standing up,
 * so it is the one that least tolerates a step being added to it.
 */
test.describe("engine hours from the dashboard", () => {
  test.skip(!hasStack, skipReason);

  test("notes a reading within the tap budget", async ({ page, request }) => {
    await signIn(page, request, SEED.users.owner, `/boats/${SEED.boat}/dashboard`);
    await expect(
      page.getByRole("heading", { name: SEED.boatName, level: 1 }).first(),
    ).toBeVisible();

    const taps = new TapCounter(page);

    // 1 — the "+" on the engine strip, which carries the hours.
    await taps.tap(page.getByRole("button", { name: fr.dashboard.engines.addReading }).first());
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // The engine is already chosen (this boat has one) and the date is already today, so the
    // counter is the only thing left to say. Typing is not a tap.
    // Anchored rather than exact: `Field` appends an aria-hidden " *" to the label of a
    // required field, so the label's text is "Compteur *" and an exact match never lands.
    await dialog.getByLabel(new RegExp(`^${fr.engines.reading.hours}`)).fill("812");

    // 2 — save.
    await taps.tap(dialog.getByRole("button", { name: fr.common.save, exact: true }));
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    taps.expectWithin(3, "relevé d'heures");
  });
});
