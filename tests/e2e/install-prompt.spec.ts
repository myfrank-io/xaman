import { expect, test } from "@playwright/test";

/**
 * Regression test for the install prompt (E7-2).
 *
 * Chrome fires `beforeinstallprompt` once, a moment after load, and never again for that page
 * load. The listener used to be attached by a hook inside the account menu — a client component
 * that only exists inside a boat, and that mounts after hydration — so the event was routinely
 * dropped and « Installer l'application » offered no button: tapping it appeared to do nothing.
 *
 * The capture now runs inline in the document head. This test fires the event while the page is
 * still loading, which is the case that used to fail, and asserts the button comes back.
 */
test("an install prompt fired before hydration still reaches the dialog", async ({ page }) => {
  await page.goto("/dev/ui/dashboard", { waitUntil: "domcontentloaded" });

  // The window that used to lose it: the head has been parsed, so the inline capture is
  // listening, but React has not hydrated and the account menu does not exist yet. Chrome fires
  // later still — it waits for the manifest and the service worker — so this is the early edge.
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt?: () => Promise<void>;
      userChoice?: Promise<{ outcome: string }>;
    };
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });

  await expect(
    page.evaluate(
      () => (window as unknown as Record<string, unknown>).__xamanInstallPrompt !== null,
    ),
  ).resolves.toBe(true);

  // Only now let the application finish loading: the point is that the event arrived first.
  await page.waitForLoadState("networkidle");

  // Two placements for the same entries: a « Plus » sheet below `lg`, a dropdown above it.
  const more = page.getByRole("button", { name: "Plus" });
  if (await more.isVisible().catch(() => false)) {
    await more.click();
  } else {
    await page
      .getByRole("button", { name: /Xavier|Marin/i })
      .first()
      .click();
  }
  // A flat button in the sheet, a menu item in the dropdown — the same entry either way.
  const installEntry = page
    .getByRole("menuitem", { name: "Installer l'application" })
    .or(page.getByRole("button", { name: "Installer l'application" }));
  await installEntry.first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Installer", exact: true })).toBeVisible();
});
