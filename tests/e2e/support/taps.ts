import { expect, type Locator, type Page } from "@playwright/test";

/**
 * The interaction budget of `SPEC.md §7` and E9-3: an oil change is seven taps, ticking a
 * checklist point three, an hour reading three. The budget is the point of the journey, not a
 * detail of it — a screen that gains a step has to be seen to gain it — so the taps are counted
 * rather than described.
 *
 * Only deliberate taps count: what a hand does on the glass. Typing into a field that a tap
 * already opened is not a tap, which is why `fill` is not wrapped.
 */
export class TapCounter {
  private count = 0;

  constructor(private readonly page: Page) {}

  /** One tap on a target, waited for like any user interaction. */
  async tap(target: Locator | string): Promise<void> {
    const locator = typeof target === "string" ? this.page.locator(target) : target;
    await locator.tap();
    this.count += 1;
  }

  get taps(): number {
    return this.count;
  }

  /**
   * Assert the budget. The message names the journey so a regression reads as
   * "vidange: 9 taps (budget 7)" in CI rather than as a bare number mismatch.
   */
  expectWithin(budget: number, journey: string): void {
    expect(this.count, `${journey}: ${this.count} taps (budget ${budget})`).toBeLessThanOrEqual(
      budget,
    );
  }
}
