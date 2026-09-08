import { describe, expect, it } from "vitest";

import { isPublic } from "@/proxy";

/**
 * The gate in front of every screen, and what has to stay outside it.
 *
 * Written after the mail-delivery webhook (D79) spent its first six events being answered
 * `307 → /login`. A webhook sender does not follow redirects and does not sign in, so an
 * endpoint behind this gate is an endpoint that can never be reached — and nothing said so:
 * the route was deployed, the events left, the screen stayed silent.
 *
 * Reachable is not open. `/api/webhooks/resend` verifies its own signature and refuses
 * everything else (`tests/unit/email-delivery.test.ts`); it is the gate that has no way to
 * check it, since there is no session to check.
 */
describe("who gets past the session gate", () => {
  it("lets the mailer's webhook through", () => {
    expect(isPublic("/api/webhooks/resend")).toBe(true);
  });

  it("keeps the boat behind it", () => {
    for (const path of [
      "/boats",
      "/boats/0406f409/members",
      "/api",
      "/api/anything-else",
      "/apiary",
    ]) {
      expect(isPublic(path), path).toBe(false);
    }
  });

  it("keeps letting in the ways in, and the invitation", () => {
    for (const path of ["/", "/login", "/signup", "/forgot-password", "/invite/abc", "/health"]) {
      expect(isPublic(path), path).toBe(true);
    }
  });
});
