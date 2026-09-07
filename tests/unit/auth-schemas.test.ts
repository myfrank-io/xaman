import { describe, expect, it } from "vitest";

import { OTP_MAX, OTP_MIN, otpSchema } from "@/lib/schemas/auth";

const token = (value: string) =>
  otpSchema.safeParse({ email: "x@example.fr", token: value }).success;

/**
 * The length of the e-mail code is a Supabase project setting (« Email OTP Length », 6 to 10),
 * not something this app decides. It was hard-coded to six here, in the field's `maxLength` and
 * in three sentences — and a project sending eight produced a code nobody could even type: the
 * input stopped at six characters, and the schema refused whatever got past it.
 */
describe("e-mail code", () => {
  it("accepts every length Supabase can be set to send", () => {
    for (let length = OTP_MIN; length <= OTP_MAX; length += 1) {
      expect(token("9".repeat(length)), `${length} digits`).toBe(true);
    }
  });

  it("still refuses what is not a code", () => {
    expect(token("9".repeat(OTP_MIN - 1)), "too short").toBe(false);
    expect(token("9".repeat(OTP_MAX + 1)), "too long").toBe(false);
    expect(token("97510 72"), "a space inside").toBe(false);
    expect(token("975a0872"), "a letter").toBe(false);
    expect(token(""), "empty").toBe(false);
  });

  // Someone copying the code out of the e-mail brings the spaces around it with them.
  it("forgives the whitespace a copy-paste carries", () => {
    expect(token("  975108  ")).toBe(true);
  });
});
