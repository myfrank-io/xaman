import { expect, test } from "@playwright/test";

/**
 * « Choisir dans mes contacts » on the provider form (D52, D57).
 *
 * Two things are asserted, and the second matters more than the first: the button must be
 * ABSENT where the browser has no address book to open. That is most iPhones — Safari keeps the
 * Contact Picker behind a feature flag — and there is no web API to fall back to, so a button
 * that cannot work would cost a tap and teach nothing. It was proposed that it replace
 * « Importer » on a phone; on those devices that would have removed importing altogether.
 */
const FAKE_PICKER = () => {
  Object.defineProperty(navigator, "contacts", {
    configurable: true,
    value: {
      getProperties: async () => ["name", "tel", "email"],
      select: async () => [
        {
          name: ["Voilerie All Purpose"],
          tel: ["02 97 00 00 00"],
          email: ["contact@allpurpose.example"],
        },
      ],
    },
  });
};

const LABEL = "Choisir dans mes contacts";

test("explains itself when the browser exposes no address book", async ({ page }) => {
  await page.goto("/dev/ui/contacts", { waitUntil: "networkidle" });
  // Headless Chromium has no Contact Picker, which is the iPhone case too.
  await expect(page.getByRole("button", { name: LABEL })).toHaveCount(0);
  // And it must not be silent about it: « je ne le vois toujours pas » came back three times
  // because an absent button and an undeployed one look the same from the outside.
  await expect(page.getByText(/ne donne pas accès au carnet d'adresses/)).toBeVisible();
});

test("fills the new provider's fields from the picked card", async ({ page }) => {
  await page.addInitScript(FAKE_PICKER);
  await page.goto("/dev/ui/contacts", { waitUntil: "networkidle" });

  const button = page.getByRole("button", { name: LABEL });
  await expect(button).toHaveCount(1); // the creation form only: it would overwrite an edit
  const form = page.locator("form").filter({ has: button }).first();
  await button.click();

  await expect(form.locator("#contact-name").first()).toHaveValue("Voilerie All Purpose");
  await expect(form.locator("#contact-phone").first()).toHaveValue("02 97 00 00 00");
  await expect(form.locator("#contact-email").first()).toHaveValue("contact@allpurpose.example");
});
