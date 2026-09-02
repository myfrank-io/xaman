import { expect, test, type Page } from "@playwright/test";

/**
 * Touch audit of the design-system pages (CLAUDE.md rule 1): every control at least 44 px
 * high, every field at least 16 px of text, no horizontal scrolling, no console error.
 * The /dev/ui pages mount the real components with sample data, so the whole component
 * library is covered without a database.
 */
const PAGES = [
  "/dev/ui",
  "/dev/ui/dashboard",
  "/dev/ui/contacts",
  "/dev/ui/boat",
  "/dev/ui/boat/engine",
  "/dev/ui/boat/engine-form",
  "/dev/ui/boat/equipment-form",
  "/dev/ui/boat/settings",
];

const MIN_TARGET = 44;
const MIN_FONT = 16;

type Offender = {
  tag: string;
  text: string;
  cls: string;
  width: number;
  height: number;
  fontSize?: number;
};

async function audit(
  page: Page,
): Promise<{ controls: Offender[]; fields: Offender[]; overflow: number }> {
  return page.evaluate(
    ({ minTarget, minFont }) => {
      const visible = (el: Element) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      };
      const describe = (el: Element): Offender => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40),
          cls: (el.getAttribute("class") ?? "").slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };
      // Buttons and tab links are the wet-finger targets; inline text links are exempt.
      const controls = [
        ...document.querySelectorAll(
          'button, [role="button"], [role="tab"], nav a, a[data-slot="button"]',
        ),
      ]
        .filter(visible)
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.height < minTarget - 0.5 || rect.width < minTarget - 0.5;
        })
        .map(describe);
      const fields = [...document.querySelectorAll("input, select, textarea")]
        .filter(visible)
        .filter(
          (el) =>
            (el as HTMLInputElement).type !== "checkbox" &&
            (el as HTMLInputElement).type !== "radio",
        )
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          const fontSize = parseFloat(getComputedStyle(el).fontSize);
          return rect.height < minTarget - 0.5 || fontSize < minFont;
        })
        .map((el) => ({ ...describe(el), fontSize: parseFloat(getComputedStyle(el).fontSize) }));
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      return { controls, fields, overflow };
    },
    { minTarget: MIN_TARGET, minFont: MIN_FONT },
  );
}

for (const path of PAGES) {
  test(`${path} renders cleanly and respects the touch rules`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status(), `${path} status`).toBe(200);
    await expect(page.locator("main, body").first()).toBeVisible();

    const result = await audit(page);
    expect(
      result.overflow,
      `${path} scrolls horizontally by ${result.overflow}px`,
    ).toBeLessThanOrEqual(0);
    expect(
      result.controls,
      `${path} controls under ${MIN_TARGET}px: ${JSON.stringify(result.controls)}`,
    ).toEqual([]);
    expect(
      result.fields,
      `${path} fields under ${MIN_TARGET}px / ${MIN_FONT}px: ${JSON.stringify(result.fields)}`,
    ).toEqual([]);
    expect(errors, `${path} console errors`).toEqual([]);
  });
}
