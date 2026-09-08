import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/redirect";

/**
 * `?next=` is written by whoever sends the link, not by the app: it is the one value on the
 * sign-in screen an attacker chooses. Everything that is not a path *of this site* must come
 * back as the fallback, or a freshly signed-in person lands on somebody else's login form.
 */
describe("safeNextPath", () => {
  it("falls back when there is nothing to go back to", () => {
    expect(safeNextPath(undefined)).toBe("/boats");
    expect(safeNextPath(null)).toBe("/boats");
    expect(safeNextPath("")).toBe("/boats");
    expect(safeNextPath(undefined, "/boats/x/dashboard")).toBe("/boats/x/dashboard");
  });

  it("keeps a path of this site, with its query", () => {
    expect(safeNextPath("/boats/x")).toBe("/boats/x");
    expect(safeNextPath("/boats?tab=1#h")).toBe("/boats?tab=1");
  });

  it("refuses another site, however it is spelled", () => {
    expect(safeNextPath("//evil.com")).toBe("/boats");
    expect(safeNextPath("/\\evil.com")).toBe("/boats");
    expect(safeNextPath("/\\/evil.com")).toBe("/boats");
    expect(safeNextPath("https://evil.com")).toBe("/boats");
    expect(safeNextPath("javascript:alert(1)")).toBe("/boats");
    expect(safeNextPath("boats")).toBe("/boats");
  });
});
