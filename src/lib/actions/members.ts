"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { recordInvitationSent } from "@/lib/email/delivery";
import { invitationEmail } from "@/lib/email/invitation";
import { mailerConfigured, sendMail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
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
  const data = {
    boat_name: boat?.name ?? "",
    inviter_name: inviter?.full_name ?? inviter?.email ?? "",
    role_label: t(role),
  };

  // The row stays either way: the dialog offers the link, so a mailer having a bad day costs
  // an e-mail, never the invitation.
  let emailFailed = false;
  if (mailerConfigured()) {
    const { subject, html } = invitationEmail({
      email,
      inviteUrl: redirectTo,
      boatName: data.boat_name,
      inviterName: data.inviter_name,
      roleLabel: data.role_label,
      appUrl: publicEnv.appUrl,
    });
    const sent = await sendMail({ to: email, subject, html });
    emailFailed = !sent.sent;
    // Accepted is not received (D79): the id is what the bounce, three seconds later, is named
    // by — and what turns the row on the Membres screen into « Non délivré ».
    if (sent.sent && sent.id) await recordInvitationSent(invitationId, sent.id);
  } else {
    try {
      const admin = createAdminClient();
      const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data,
        redirectTo,
      });
      if (inviteError) {
        // Already registered: a sign-in code that lands on the invitation page.
        const { error: otpError } = await admin.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        });
        emailFailed = otpError !== null;
      }
    } catch {
      emailFailed = true;
    }
  }

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
