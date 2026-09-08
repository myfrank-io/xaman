"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { recordInvitationSent } from "@/lib/email/delivery";
import { toDeliveryStatus } from "@/lib/email/delivery-status";
import { invitationEmail } from "@/lib/email/invitation";
import { mailerConfigured, sendMail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import {
  canRemind,
  remindedTooRecently,
  INVITATION_VALIDITY_DAYS,
  type InvitationStatus,
} from "@/lib/invitations";
import { addDays, toIsoDate } from "@/lib/numbers";
import { EDITOR_ASSIGNABLE_ROLES } from "@/lib/permissions";
import {
  acceptInvitationSchema,
  changeMemberRoleSchema,
  extendMemberAccessSchema,
  inviteMemberSchema,
  inviteNewOwnerSchema,
  leaveBoatSchema,
  removeMemberSchema,
  resendInvitationSchema,
  revokeInvitationSchema,
} from "@/lib/schemas/members";
import { boatPath } from "@/lib/queries/boat-routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const invitationIdSchema = z.uuid();

type InvitationRole = "owner" | "editor" | "pro" | "viewer";

export type SentInvitation = {
  invitationId: string;
  inviteUrl: string;
  validUntil: string | null;
  /** The row exists, the message did not go out: the dialog says so and offers the link. */
  emailFailed: boolean;
};

type InvitationMail = {
  email: string;
  /** `/invite/[token]`: the invitation's own address, never an auth verification link (D75). */
  inviteUrl: string;
  boatName: string;
  inviterName: string;
  roleLabel: string;
};

/**
 * Sends *the* invitation e-mail, by whichever of the two paths this deploy has (D75), and hands
 * back the provider's id when there is one to follow afterwards (D79).
 *
 * One function because there are two callers now — the first send and the manual reminder
 * (D110) — and « the reminder is the same message » has to be true in the code, not only in the
 * intention. With a mailer configured the app sends it itself, from the HTML generated out of
 * `supabase/templates/invite.html`; without one, Supabase Auth does, with the `invite` template
 * for an address it does not know and a sign-in code for one it does. Neither of those two
 * answers with an id, so a deploy without a mailer has no delivery status — which is exactly
 * what a null `delivery_status` means on the screen.
 */
async function sendInvitationMail(
  mail: InvitationMail,
): Promise<{ sent: boolean; emailId: string | null }> {
  if (mailerConfigured()) {
    const { subject, html } = invitationEmail({ ...mail, appUrl: publicEnv.appUrl });
    const result = await sendMail({ to: mail.email, subject, html });
    return { sent: result.sent, emailId: result.sent ? result.id : null };
  }
  try {
    const admin = createAdminClient();
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(mail.email, {
      data: {
        boat_name: mail.boatName,
        inviter_name: mail.inviterName,
        role_label: mail.roleLabel,
      },
      redirectTo: mail.inviteUrl,
    });
    if (!inviteError) return { sent: true, emailId: null };
    // Already registered: a sign-in code that lands on the invitation page.
    const { error: otpError } = await admin.auth.signInWithOtp({
      email: mail.email,
      options: { emailRedirectTo: mail.inviteUrl, shouldCreateUser: false },
    });
    return { sent: otpError === null, emailId: null };
  } catch {
    return { sent: false, emailId: null };
  }
}

/**
 * Inserts the row with the user's client (RLS decides who may invite whom), reads nothing
 * sensitive back, sends the invitation, and returns the link so the dialog can also offer it to
 * copy or share.
 *
 * **Twice is once (rule 11).** The id is drawn when the dialog opens and travels with the form,
 * and the insert is `on conflict (id) do nothing`: a second submission of the same invitation —
 * a lost answer, a double tap — finds its own row and adds nothing. What that costs is the
 * token: `do nothing` keeps the one already stored, so the freshly drawn one is worthless and
 * the link must be read back before it is handed out (`storedToken`). Nothing is updated on the
 * conflict path — `authenticated` may only ever write `revoked_at` on this table (0002).
 *
 * **A mailer having a bad day is not a lost invitation.** The row is created first and the send
 * comes after, so a refused send returns `emailFailed` alongside the link rather than a failure:
 * the invitation exists, the dialog says the message did not leave, and the link is there to be
 * copied. Returning a failure was what made the owner press « Inviter » again — and, before the
 * id travelled with the form, that second press created a second pending invitation.
 *
 * **Who sends it (D75).** With a mailer configured, the app sends the invitation itself and
 * Supabase Auth is not involved. That is the whole point: `inviteUserByEmail` refuses an address
 * that already has an account — `422: A user with this email address has already been
 * registered` — and « has an account » is not « is already aboard ». Someone removed from a boat,
 * or a member of another boat entirely, kept their account and could only be sent a sign-in code
 * that says nothing about the invitation. The app knows the difference; the auth endpoint cannot.
 *
 * Nobody's account is created up front any more, and nothing is lost by that: the invitee lands
 * on /invite/[token], signs in with a code — which creates the account on first use — and
 * accepts. The same path an invited stranger already took.
 *
 * **Without a mailer**, the previous behaviour is kept exactly: the `invite` template for a new
 * address, a sign-in code for one that already exists. Both live in `supabase/templates/` (D71),
 * and the invitation e-mail sent here is generated from the same file, so the two cannot drift.
 */
async function createInvitation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  values: {
    boatId: string;
    email: string;
    role: InvitationRole;
    validUntil: string | null;
    /** Drawn by the form when it opened, so a retry writes the same row. */
    id?: string | null;
  },
): Promise<ActionResult<SentInvitation>> {
  const { boatId, email, role, validUntil } = values;
  let invitationId = values.id ?? randomUUID();
  let token = randomBytes(32).toString("base64url");

  const write = (id: string, value: string) =>
    supabase.from("boat_invitations").upsert(
      {
        id,
        boat_id: boatId,
        email,
        role,
        token: value,
        invited_by: userId,
        valid_until: validUntil,
      },
      { onConflict: "id", ignoreDuplicates: true, count: "exact" },
    );

  const { error, count } = await write(invitationId, token);
  if (error) return fail(dbErrorKey(error));
  if (count === 0) {
    // The row is already there from an earlier attempt: its token is the live one.
    const stored = await storedToken(supabase, { id: invitationId, boatId, email });
    if (stored) {
      token = stored;
    } else {
      // No service key to read it back with: fall back to a second row rather than handing out
      // a link that leads nowhere. One invitation too many is recoverable; a dead link is not.
      invitationId = randomUUID();
      token = randomBytes(32).toString("base64url");
      const retry = await write(invitationId, token);
      if (retry.error) return fail(dbErrorKey(retry.error));
    }
  }

  const [{ data: boat }, { data: inviter }] = await Promise.all([
    supabase.from("boats").select("name").eq("id", boatId).maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
  ]);
  const t = await getTranslations("members.roles");
  const redirectTo = `${publicEnv.appUrl}/invite/${token}`;

  // The row stays either way: the dialog offers the link, so a mailer having a bad day costs
  // an e-mail, never the invitation.
  const { sent, emailId } = await sendInvitationMail({
    email,
    inviteUrl: redirectTo,
    boatName: boat?.name ?? "",
    inviterName: inviter?.full_name ?? inviter?.email ?? "",
    roleLabel: t(role),
  });
  const emailFailed = !sent;
  // Accepted is not received (D79): the id is what the bounce, three seconds later, is named
  // by — and what turns the row on the Membres screen into « Non délivré ».
  if (emailId) await recordInvitationSent(invitationId, emailId);

  revalidatePath(boatPath(boatId, "members"));
  return ok({ invitationId, inviteUrl: redirectTo, validUntil, emailFailed });
}

/**
 * The token of an invitation this person is entitled to re-read: their own boat, the same
 * address, the id their form drew. `token` is revoked from `authenticated` (0002) — no screen
 * ever shows it — so the service key is the only way back to it, and it is bounded on all three
 * columns and behind the caller's own role, checked with their client and not with the key.
 */
async function storedToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  where: { id: string; boatId: string; email: string },
): Promise<string | null> {
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: where.boatId });
  if (role !== "owner" && role !== "editor") return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("boat_invitations")
      .select("token")
      .eq("id", where.id)
      .eq("boat_id", where.boatId)
      .eq("email", where.email)
      .maybeSingle();
    return data?.token ?? null;
  } catch {
    return null;
  }
}

export async function inviteMember(input: unknown): Promise<ActionResult<SentInvitation>> {
  const parsed = parseInput(inviteMemberSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, email, role, duration } = parsed.data;
  // The id the dialog drew when it opened. It is not part of the shared schema — it is not a
  // field of the form, it is the identity of the row the form is going to write (rule 11) — so
  // it is read beside it, and a value that is not a uuid is simply ignored.
  const id = invitationIdSchema.safeParse((input as { id?: unknown })?.id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");

  // D28: an editor invites a pro or a viewer, never a peer and never an owner, and always with
  // an end date (≤ 90 days). The insert policy refuses the same thing; this only turns a bare
  // « forbidden » into the sentence that says which half was wrong.
  const { data: inviterRole } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (inviterRole === "editor") {
    if (!EDITOR_ASSIGNABLE_ROLES.includes(role)) return fail("errors.forbidden");
    if (duration === "unlimited") return fail("errors.invitation_duration_required");
  }
  // D89: an owner never expires. A proprietor whose access lapses on a date is not a proprietor,
  // and the form hides the question rather than asking it — this is what makes that true.
  const validUntil =
    role === "owner" || duration === "unlimited" ? null : addDays(toIsoDate(), Number(duration));
  return createInvitation(supabase, user.id, {
    boatId,
    email,
    role,
    validUntil,
    id: id.success ? id.data : null,
  });
}

// E1-8 / D30, step 2: the new owner is invited as `owner`; step 3 (leaveBoat) once accepted.
export async function inviteNewOwner(input: unknown): Promise<ActionResult<SentInvitation>> {
  const parsed = parseInput(inviteNewOwnerSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");
  const id = invitationIdSchema.safeParse((input as { id?: unknown })?.id);
  return createInvitation(supabase, user.id, {
    ...parsed.data,
    role: "owner",
    validUntil: null,
    id: id.success ? id.data : null,
  });
}

// E1-8 step 3: the former owner leaves; the last-owner guard refuses while nobody else owns it.
export async function leaveBoat(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(leaveBoatSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");
  const { error, count } = await supabase
    .from("boat_members")
    .delete({ count: "exact" })
    .eq("boat_id", parsed.data.boatId)
    .eq("user_id", user.id);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");
  redirect("/boats");
}

// D29: an expired member is reactivated for 90 more days (owner only, by RLS).
export async function extendMemberAccess(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(extendMemberAccessSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("boat_members")
    .update({ valid_until: addDays(toIsoDate(), 90) }, { count: "exact" })
    .eq("boat_id", parsed.data.boatId)
    .eq("user_id", parsed.data.userId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");
  revalidatePath(boatPath(parsed.data.boatId, "members"));
  return ok(undefined);
}

export async function revokeInvitation(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(revokeInvitationSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("boat_invitations")
    .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", parsed.data.invitationId)
    .eq("boat_id", parsed.data.boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");
  revalidatePath(boatPath(parsed.data.boatId, "members"));
  return ok(undefined);
}

/**
 * The four states of an invitation, computed exactly as `boat_invitations_safe` computes them
 * (0023, 0030). The view is what every screen reads; this is for the one caller that reads the
 * table itself, with the service key, because it also needs the token.
 */
function invitationStatus(row: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): InvitationStatus {
  if (row.accepted_at) return "accepted";
  if (row.revoked_at) return "revoked";
  return Date.parse(row.expires_at) < Date.now() ? "expired" : "pending";
}

/**
 * Sends the same invitation again, to the same address (D110).
 *
 * The screen had two ways out of an invitation nobody answered, and neither was this one:
 * « Annuler », which throws it away, and « Réinviter » — the bounce path of D79 — which writes a
 * *second* pending row for the same person. What an owner wants when a message went unread is
 * the message again, at the same address, with the same link.
 *
 * **The same link.** The token is not re-drawn: `/invite/[token]` already went out, possibly to
 * somebody who saved it, and a new token would silently kill that. It is read back with the
 * service key, exactly as `storedToken` does and for the same reason — no screen may read that
 * column (0002) — and behind the caller's own role, checked with *their* client.
 *
 * **Fourteen more days.** The e-mail promises a link valid for fourteen days, so the reminder
 * makes that true again rather than handing out one that dies tomorrow. It is also what brings
 * an expired invitation back, instead of leaving a dead row beside a fresh one.
 *
 * **Nothing is written before something leaves.** The row is only touched once the message has
 * been accepted by the mailer: a refused send answers with an error the owner can act on, and
 * costs neither the cooldown nor a counter. The reverse order would make a mailer's bad minute
 * look like a reminder that went out.
 *
 * **The migration is the guard.** Read paths degrade when `0030` has not been applied yet (the
 * Membres screen falls back to the columns that have always existed); this one refuses instead,
 * on the select. Sending a message the row cannot record is how an address gets three copies of
 * the same invitation.
 */
export async function resendInvitation(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(resendInvitationSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, invitationId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");
  // Owner only — the same right that puts the list on the screen (`boat_invitations_select`).
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (role !== "owner") return fail("errors.forbidden");

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("resendInvitation: no admin client", error);
    return fail("errors.unknown");
  }

  const { data: invitation, error } = await admin
    .from("boat_invitations")
    .select(
      "email, role, token, invited_by, accepted_at, revoked_at, expires_at, delivery_status, reminded_at, reminder_count",
    )
    .eq("id", invitationId)
    .eq("boat_id", boatId)
    .maybeSingle();
  if (error) {
    console.error(`resendInvitation: invitation unreadable — ${error.message}`);
    return fail("errors.unknown");
  }
  if (!invitation) return fail("errors.invitation_not_found");

  const status = invitationStatus(invitation);
  if (!canRemind({ status, delivery: toDeliveryStatus(invitation.delivery_status) })) {
    if (status === "accepted") return fail("errors.invitation_accepted");
    if (status === "revoked") return fail("errors.invitation_revoked");
    // What is left is an address that bounced or pressed « spam »: the provider will not carry
    // another message to it, so the way out is another address (« Réinviter »), not this button.
    return fail("errors.invitation_address_refused");
  }
  if (remindedTooRecently(invitation.reminded_at)) {
    return fail("errors.invitation_reminded_recently");
  }

  // The message names whoever issued the invitation, not whoever pressed the button: it is the
  // same message as the first one. Their profile falls back to the caller's when they have left
  // the boat since — an invitation with nobody's name is worse than one with a new name.
  const inviterId = invitation.invited_by ?? user.id;
  const [{ data: boat }, { data: profiles }] = await Promise.all([
    supabase.from("boats").select("name").eq("id", boatId).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email").in("id", [inviterId, user.id]),
  ]);
  const inviter =
    profiles?.find((p) => p.id === inviterId) ?? profiles?.find((p) => p.id === user.id);
  const t = await getTranslations("members.roles");

  const { sent, emailId } = await sendInvitationMail({
    email: invitation.email,
    inviteUrl: `${publicEnv.appUrl}/invite/${invitation.token}`,
    boatName: boat?.name ?? "",
    inviterName: inviter?.full_name ?? inviter?.email ?? "",
    roleLabel: t(invitation.role),
  });
  if (!sent) return fail("errors.invitation_email_failed");

  // One statement: the reminder, the new fourteen days, and the delivery of the message that
  // just left. The old `email_id` goes with it — events about it no longer match any row, which
  // is what stops a bounce from yesterday landing on the invitation of today (D79).
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_VALIDITY_DAYS * 86_400_000);
  const { error: recordError } = await admin
    .from("boat_invitations")
    .update({
      reminded_at: now.toISOString(),
      reminder_count: (invitation.reminder_count ?? 0) + 1,
      expires_at: expiresAt.toISOString(),
      email_id: emailId,
      delivery_status: emailId ? "sent" : null,
      delivery_reason: null,
      delivery_detail: null,
      delivery_updated_at: emailId ? now.toISOString() : null,
    })
    .eq("id", invitationId)
    .eq("boat_id", boatId);
  // The message is gone; only what the screen says about it is behind. Never an error here.
  if (recordError) {
    console.error(`resendInvitation: reminder not recorded — ${recordError.message}`);
  }

  revalidatePath(boatPath(boatId, "members"));
  return ok(undefined);
}

export async function changeMemberRole(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(changeMemberRoleSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("boat_members")
    .update({ role: parsed.data.role }, { count: "exact" })
    .eq("boat_id", parsed.data.boatId)
    .eq("user_id", parsed.data.userId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");
  revalidatePath(boatPath(parsed.data.boatId, "members"));
  return ok(undefined);
}

export async function removeMember(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(removeMemberSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("boat_members")
    .delete({ count: "exact" })
    .eq("boat_id", parsed.data.boatId)
    .eq("user_id", parsed.data.userId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");
  revalidatePath(boatPath(parsed.data.boatId, "members"));
  return ok(undefined);
}

// Called from /invite/[token] once the invitee is signed in with the invited e-mail.
export async function acceptInvitation(input: unknown): Promise<ActionResult<{ boatId: string }>> {
  const parsed = parseInput(acceptInvitationSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: parsed.data.token });
  if (error || !data) return fail(dbErrorKey(error ?? { message: "invitation_not_found" }));
  // `boatPath` builds every route of the app (rule: never concatenated at the call site);
  // `redirect` wants the generated `Route` type, which a helper returning `string` cannot carry.
  redirect(boatPath(data, "dashboard") as Route);
}
