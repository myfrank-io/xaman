import { expect, test } from "@playwright/test";

import fr from "../../../src/messages/fr.json";
import { signIn } from "../support/auth";
import { E2E_BOAT_PREFIX, removeE2EBoats } from "../support/boats";
import { SEED, hasStack, skipReason } from "../support/stack";

/**
 * « Premier lancement » — the last journey named by E9-3, and the only one that opens a carnet
 * rather than using the seeded one. Three steps (D67): the boat's identity, what the logbook is
 * written on today, then the tour where the maintenance plan is chosen.
 *
 * It is the one screen sequence a person sees exactly once, which is why nobody notices when it
 * breaks.
 */
test.describe("first launch", () => {
  test.skip(!hasStack, skipReason);

  test("opens a carnet in three steps", async ({ page, request }) => {
    await removeE2EBoats(request);
    await signIn(page, request, SEED.users.owner, "/boats/new");

    const name = `${E2E_BOAT_PREFIX} ${Date.now()}`;

    // Step 1 — the identity, and nothing else (D64). Type, engine count and tender all carry a
    // default, so a name is the only thing that must be said. The CTAs here each wrap an icon
    // that is not explicitly aria-hidden, so their names are matched loosely: `exact` is worth
    // spending only where a collision demands it, as "Fait" does inside "Jamais fait".
    await page.getByLabel(new RegExp(`^${fr.boats.new.name}`)).fill(name);
    await page.getByRole("radio", { name: fr.boatType.catamaran, exact: true }).tap();
    await page.getByRole("button", { name: fr.boats.new.submit }).tap();

    // Step 2 — the logbook. "Rien à reprendre" turns the button from « Passer » into « Continuer »,
    // which is the whole point of the step: skipping is offered, not imposed.
    await page.waitForURL(/\/boats\/new\/[0-9a-f-]+\?step=2/, { timeout: 15_000 });
    await expect(page.getByText(fr.boats.onboarding.logbook.question)).toBeVisible();
    await page.getByRole("radio", { name: fr.boats.onboarding.logbook.format.none }).tap();
    await page.getByRole("link", { name: fr.boats.onboarding.logbook.next }).tap();

    // Step 3 — the tour. The plan is left on « Je choisirai plus tard »: a carnet has to open
    // without one, and the checklist tab is where it is chosen afterwards (D67).
    await page.waitForURL(/\/boats\/new\/[0-9a-f-]+\?step=3/, { timeout: 15_000 });
    await expect(page.getByLabel(fr.boats.onboarding.tour.plan.label)).toBeVisible();
    await page.getByRole("button", { name: fr.boats.onboarding.tour.finish }).tap();

    // The carnet is open, on its own dashboard, under its own name.
    await page.waitForURL(/\/boats\/[0-9a-f-]+\/dashboard/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name, level: 1 }).first()).toBeVisible();
  });
});
