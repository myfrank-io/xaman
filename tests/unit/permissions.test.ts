import { describe, expect, it } from "vitest";

import { can } from "@/lib/permissions";

describe("can()", () => {
  it("matches the SPEC §4.3 matrix", () => {
    expect(can("owner", "write")).toBe(true);
    expect(can("editor", "write")).toBe(true);
    expect(can("pro", "write")).toBe(false);
    expect(can("viewer", "write")).toBe(false);

    expect(can("pro", "contribute")).toBe(true);
    expect(can("viewer", "contribute")).toBe(false);

    expect(can("owner", "manageMembers")).toBe(true);
    expect(can("editor", "manageMembers")).toBe(false);
    expect(can("owner", "deleteBoat")).toBe(true);
    expect(can("editor", "deleteBoat")).toBe(false);
  });

  it("denies everything without a role (non-member) and for the reserved renter role", () => {
    expect(can(null, "contribute")).toBe(false);
    expect(can(undefined, "write")).toBe(false);
    expect(can("renter", "contribute")).toBe(false);
  });
});
