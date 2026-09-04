import { expect, test, type Page } from "@playwright/test";

/**
 * Touch audit of the design-system pages (CLAUDE.md rule 1): every control at least 44 px
 * high, every field at least 16 px of text, no horizontal scrolling, no console error.
 * The /dev/ui pages mount the real components with sample data, so the whole component
 * library is covered without a database.
 */
const PAGES = [
  // Public pages: the home page and the four ways in are the first thing anyone touches.
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/dev/ui",
  "/dev/ui/dashboard",
  "/dev/ui/contacts",
  "/dev/ui/checklist",
  "/dev/ui/boat",
  "/dev/ui/boat/engine",
  "/dev/ui/boat/engine-form",
  "/dev/ui/boat/equipment-form",
  "/dev/ui/boat/settings",
  "/dev/ui/supplies",
  "/dev/ui/haul-outs",
  "/dev/ui/logs",
  "/dev/ui/attachments",
  "/dev/ui/review",
  "/dev/ui/import",
  "/dev/ui/install",
  // The account screen had no preview at all until D45 put a password card on it.
  "/dev/ui/profile",
  // The densest row in the app: title, two metadata lines, an amount and two buttons (D40).
  "/dev/ui/trash",
  // Six screens that had no preview at all, so the audit had never opened them: each is either
  // several queries deep, gated behind a role, or reachable only once in the life of a boat.
  "/dev/ui/boats",
  // The first screen of anyone who signs up without an invitation (D64), and one nobody on the
  // team can reach any more: every account here already has a boat.
  "/dev/ui/boats/new",
  // Steps 2 and 3 of the same flow (D67): the import panels and the tour, four dense surfaces
  // that exist only in the minutes after a carnet is opened.
  "/dev/ui/onboarding",
  // The second half of the split onboarding (D65): only ever seen on a brand-new boat.
  "/dev/ui/checklist-plan",
  "/dev/ui/members",
  "/dev/ui/report",
  "/dev/ui/reset-password",
  "/dev/ui/checklist-setup",
  "/dev/ui/checklist-form",
  // A dialog is closed on load, so the audit had never seen inside one — and they are the
  // densest surfaces in the app: a date, a counter, a picker and a note in a box that must fit
  // above a phone keyboard. `?d=` / `?dialog=` open exactly one.
  "/dev/ui/dialogs?d=complete",
  "/dev/ui/dialogs?d=hours",
  "/dev/ui/dialogs?d=edit-reading",
  "/dev/ui/dialogs?d=contact",
  "/dev/ui/dialogs?d=recurring",
  "/dev/ui/supplies?dialog=1",
];

const MIN_TARGET = 44;
const MIN_FONT = 16;
/**
 * How tall a REPEATED tappable row may be on a phone.
 *
 * This is the rule nothing was measuring. Overflow and 44 px targets both passed, on every
 * viewport, while the checklist rendered one 175 px card per system: nine systems filled
 * 1 600 px, two fitted a screen, and « trop gros trop zoomé, bloc pas simple à utiliser » was
 * reported from the boat with a green audit behind it.
 *
 * 120 px is picked from what the app actually produces: a list row is 64 or 76 px, a contact
 * card 64, the four dashboard tiles about 110 — and the card that caused the complaint was 175.
 * It discriminates exactly where it should. Above `sm` there is room for cards, so it applies
 * to phone widths only.
 */
const MAX_REPEATED_ROW = 120;

type Offender = {
  tag: string;
  text: string;
  cls: string;
  width: number;
  height: number;
  fontSize?: number;
  /** Pixels the box runs past the right edge of the viewport. */
  over?: number;
  /** How many identical siblings this row has: what makes it a list rather than a card. */
  repeated?: number;
};

async function audit(page: Page): Promise<{
  controls: Offender[];
  fields: Offender[];
  clipped: Offender[];
  overflow: number;
  wider: Offender[];
  tall: Offender[];
}> {
  return page.evaluate(
    ({ minTarget, minFont, minRow }) => {
      const visible = (el: Element) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        // A control clipped to a pixel is visually hidden on purpose — a file input opened by
        // a real button, a screen-reader-only field. Nobody aims a finger at it.
        return (
          rect.width > 1 &&
          rect.height > 1 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !el.closest("[hidden]")
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
      // A label wider than the button that paints it: « Sorties de l'eau » spilling out of its
      // pill was reported from the boat. Ellipsised and visually hidden labels are exempt.
      const clipped = [
        ...document.querySelectorAll(
          'button, [data-slot="toggle-group-item"], [data-slot="tabs-trigger"], a[data-slot="button"]',
        ),
      ]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) return false;
          const style = getComputedStyle(el);
          if (style.textOverflow === "ellipsis" || style.overflow === "hidden") return false;
          return el.scrollWidth > Math.ceil(rect.width) + 2;
        })
        .map(describe);
      // `document.scrollWidth` is not enough: `globals.css` sets `overflow-x: clip` on the
      // document so a wide box cannot drag the page sideways, which also means it reports zero
      // while the content is genuinely cut off — the check passed on a card hanging 129 px off
      // a 320 px screen. So look at the boxes themselves, and only count one as an offender
      // when nothing between it and the body clips or scrolls within the viewport.
      const vw = window.innerWidth;
      const containedInAScroller = (el: Element) => {
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const ox = getComputedStyle(a).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") {
            if (a.getBoundingClientRect().right <= vw + 1) return true;
          }
        }
        return false;
      };
      const wider = [...document.querySelectorAll("body *")]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) return false;
          if (rect.right <= vw + 1) return false;
          if (containedInAScroller(el)) return false;
          // Report the outermost box of a chain, not every descendant it drags along.
          const parent = el.parentElement;
          return !(
            parent &&
            parent.getBoundingClientRect().right > vw + 1 &&
            !containedInAScroller(parent)
          );
        })
        .map((el) => ({ ...describe(el), over: Math.round(el.getBoundingClientRect().right - vw) }))
        .slice(0, 8);
      /**
       * Repeated tappable rows that are too tall for a phone.
       *
       * « Repeated » means three or more siblings built from the same markup — a list, a grid,
       * a set of tiles. One tall card is a design choice; nine of them is a screen you scroll
       * to learn what exists. Restricted to links and buttons, which is what a row of a list
       * is, so an expanded accordion or a form section is not caught by it.
       */
      const tall: Offender[] = [];
      if (vw < 640) {
        const seen = new Set<Element>();
        for (const el of document.querySelectorAll("a, button")) {
          if (seen.has(el)) continue;
          const parent = el.parentElement?.parentElement ?? el.parentElement;
          if (!parent) continue;
          const signature = `${el.tagName}|${el.getAttribute("class") ?? ""}`;
          const siblings = [...(el.parentElement?.children ?? [])].filter(
            (s) => `${s.tagName}|${s.getAttribute("class") ?? ""}` === signature,
          );
          // A grid or list wraps each row in an `li` or a `div`, so also look one level out.
          const cousins =
            siblings.length >= 3
              ? siblings
              : [...parent.querySelectorAll(":scope > * > a, :scope > * > button")].filter(
                  (s) => `${s.tagName}|${s.getAttribute("class") ?? ""}` === signature,
                );
          if (cousins.length < 3) continue;
          for (const c of cousins) seen.add(c);
          const rect = el.getBoundingClientRect();
          if (rect.height > minRow + 0.5 && rect.width > 100) {
            tall.push({ ...describe(el), repeated: cousins.length });
          }
        }
      }
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      return { controls, fields, clipped, overflow, wider, tall: tall.slice(0, 6) };
    },
    { minTarget: MIN_TARGET, minFont: MIN_FONT, minRow: MAX_REPEATED_ROW },
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
      result.wider,
      `${path} boxes running past the right edge: ${JSON.stringify(result.wider)}`,
    ).toEqual([]);
    expect(
      result.controls,
      `${path} controls under ${MIN_TARGET}px: ${JSON.stringify(result.controls)}`,
    ).toEqual([]);
    expect(
      result.clipped,
      `${path} labels wider than their button: ${JSON.stringify(result.clipped)}`,
    ).toEqual([]);
    expect(
      result.fields,
      `${path} fields under ${MIN_TARGET}px / ${MIN_FONT}px: ${JSON.stringify(result.fields)}`,
    ).toEqual([]);
    expect(
      result.tall,
      `${path} repeated rows over ${MAX_REPEATED_ROW}px on a phone: ${JSON.stringify(result.tall)}`,
    ).toEqual([]);
    expect(errors, `${path} console errors`).toEqual([]);
  });
}
