"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

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
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function membersPath(boatId: string) {
  return `/boats/${boatId}/members`;
}

type InvitationRole = "owner" | "editor" | "pro" | "viewer";

/**
 * Inserts the row with the user's client (RLS decides who may invite whom), reads nothing
 * sensitive back, sends the invitation, and returns the link so the dialog can also offer it to
 * copy or share.
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
  values: { boatId: string; email: string; role: InvitationRole; validUntil: string | null },
): Promise<ActionResult<{ invitationId: string; inviteUrl: string; validUntil: string | null }>> {
  const { boatId, email, role, validUntil } = values;
  const token = randomBytes(32).toString("base64url");
  const { data: invitation, error } = await supabase
    .from("boat_invitations")
    .insert({ boat_id: boatId, email, role, token, invited_by: userId, valid_until: validUntil })
    .select("id")
    .single();
  if (error || !invitation) return fail(dbErrorKey(error ?? { message: "insert failed" }));

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

  if (mailerConfigured()) {
    const { subject, html } = invitationEmail({
      email,
      inviteUrl: redirectTo,
      boatName: data.boat_name,
      inviterName: data.inviter_name,
      roleLabel: data.role_label,
      appUrl: publicEnv.appUrl,
    });
    // The row stays either way: the dialog offers the link, so a mailer having a bad day costs
    // an e-mail, never the invitation.
    const sent = await sendMail({ to: email, subject, html });
    if (!sent.sent) return fail("errors.invitation_email");
    // Accepted is not received (D77): the id is what the bounce, three seconds later, is named
    // by — and what turns the row on the Membres screen into « Non délivré ».
    if (sent.id) await recordInvitationSent(invitation.id, sent.id);
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
        if (otpError) return fail("errors.invitation_email");
      }
    } catch {
      return fail("errors.invitation_email");
    }
  }

  revalidatePath(membersPath(boatId));
  return ok({ invitationId: invitation.id, inviteUrl: redirectTo, validUntil });
}

export async function inviteMember(
  input: unknown,
): Promise<ActionResult<{ invitationId: string; inviteUrl: string; validUntil: string | null }>> {
  const parsed = parseInput(inviteMemberSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, email, role, duration } = parsed.data;

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
  // D73: an owner never expires. A proprietor whose access lapses on a date is not a proprietor,
  // and the form hides the question rather than asking it — this is what makes that true.
  const validUntil =
    role === "owner" || duration === "unlimited" ? null : addDays(toIsoDate(), Number(duration));
  return createInvitation(supabase, user.id, { boatId, email, role, validUntil });
}

// E1-8 / D30, step 2: the new owner is invited as `owner`; step 3 (leaveBoat) once accepted.
export async function inviteNewOwner(
  input: unknown,
): Promise<ActionResult<{ invitationId: string; inviteUrl: string; validUntil: string | null }>> {
  const parsed = parseInput(inviteNewOwnerSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");
  return createInvitation(supabase, user.id, { ...parsed.data, role: "owner", validUntil: null });
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
  revalidatePath(membersPath(parsed.data.boatId));
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
  revalidatePath(membersPath(parsed.data.boatId));
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
  revalidatePath(membersPath(parsed.data.boatId));
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
  revalidatePath(membersPath(parsed.data.boatId));
  return ok(undefined);
}

// Called from /invite/[token] once the invitee is signed in with the invited e-mail.
export async function acceptInvitation(input: unknown): Promise<ActionResult<{ boatId: string }>> {
  const parsed = parseInput(acceptInvitationSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: parsed.data.token });
  if (error || !data) return fail(dbErrorKey(error ?? { message: "invitation_not_found" }));
  redirect(`/boats/${data}/dashboard`);
}
