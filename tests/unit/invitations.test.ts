import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  canRemind,
  remindedTooRecently,
  INVITATION_VALIDITY_DAYS,
  REMINDER_COOLDOWN_MS,
  type RemindableInvitation,
} from "@/lib/invitations";

/**
 * The rules of a manual reminder (D109). They live in one pure module because two callers read
 * them — the Server Action, which decides, and the Membres screen, which shows the button — and
 * a button offered for an action the server refuses is worse than no button at all.
 */
const invitation = (over: Partial<RemindableInvitation> = {}): RemindableInvitation => ({
  status: "pending",
  delivery: null,
  ...over,
});

describe("canRemind", () => {
  it("sends again to somebody who simply never answered", () => {
    expect(canRemind(invitation())).toBe(true);
    expect(canRemind(invitation({ delivery: "sent" }))).toBe(true);
    expect(canRemind(invitation({ delivery: "delivered" }))).toBe(true);
    expect(canRemind(invitation({ delivery: "delayed" }))).toBe(true);
  });

  it("revives an expired invitation rather than leaving a dead row beside a fresh one", () => {
    expect(canRemind(invitation({ status: "expired" }))).toBe(true);
  });

  it("refuses what is already over", () => {
    expect(canRemind(invitation({ status: "accepted" }))).toBe(false);
    expect(canRemind(invitation({ status: "revoked" }))).toBe(false);
  });

  it("refuses an address that bounced or pressed « spam »: nothing more will reach it", () => {
    expect(canRemind(invitation({ delivery: "bounced" }))).toBe(false);
    expect(canRemind(invitation({ delivery: "complained" }))).toBe(false);
  });

  it("sends again when the message never left the provider at all", () => {
    // `failed` is the send itself failing — a key, a domain, a bad minute. Retrying is the point.
    expect(canRemind(invitation({ delivery: "failed" }))).toBe(true);
  });
});

describe("remindedTooRecently", () => {
  const now = Date.parse("2026-09-08T12:00:00.000Z");

  it("lets an invitation nobody has relaunched through", () => {
    expect(remindedTooRecently(null, now)).toBe(false);
    expect(remindedTooRecently(undefined, now)).toBe(false);
    expect(remindedTooRecently("pas une date", now)).toBe(false);
  });

  it("holds the hour after a reminder, and opens again at the end of it", () => {
    expect(remindedTooRecently(new Date(now - 1_000).toISOString(), now)).toBe(true);
    expect(remindedTooRecently(new Date(now - REMINDER_COOLDOWN_MS + 1).toISOString(), now)).toBe(
      true,
    );
    expect(remindedTooRecently(new Date(now - REMINDER_COOLDOWN_MS).toISOString(), now)).toBe(
      false,
    );
    expect(remindedTooRecently("2026-09-01T12:00:00.000Z", now)).toBe(false);
  });

  it("never blocks for ever on a timestamp from the future", () => {
    // A clock behind the database's would otherwise lock the button until it caught up.
    expect(remindedTooRecently(new Date(now + 60_000).toISOString(), now)).toBe(false);
  });
});

describe("the window the e-mail promises", () => {
  it("is the default of expires_at, so a reminder restarts exactly what 0001 grants", () => {
    // Parity, not a magic number: the reminder writes `expires_at` itself, and « valable 14
    // jours » is written in the e-mail. If the column's default ever moves, this fails here
    // rather than on the day somebody's link dies four days early.
    const init = readFileSync(
      path.join(process.cwd(), "supabase/migrations/0001_init.sql"),
      "utf8",
    );
    expect(init).toContain(`now() + interval '${INVITATION_VALIDITY_DAYS} days'`);
  });
});
