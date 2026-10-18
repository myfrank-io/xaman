"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { credentialsEmail } from "@/lib/email/credentials";
import { toDeliveryStatus } from "@/lib/email/delivery-status";
import { sendMail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import { canRemind, remindedTooRecently, type InvitationStatus } from "@/lib/invitations";
import { addDays, toIsoDate } from "@/lib/numbers";
import { EDITOR_ASSIGNABLE_ROLES } from "@/lib/permissions";
import {
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

type InvitationRole = "owner" | "editor" | "pro" | "viewer";

export type GrantedAccess = {
  email: string;
  /** A fresh Xaman account, as opposed to someone who already had one on another boat. */
  created: boolean;
  /** The row exists either way (D151 — the grant already happened); only the message stayed
   *  behind. */
  emailFailed: boolean;
  /**
   * Only present when a password was generated *and* the e-mail carrying it failed to leave:
   * the one moment the owner has to hand it over themselves. Never shown after a successful
   * send, and never present at all for someone who already had an account.
   */
  password: string | null;
};

/** Twelve base64url characters: within `passwordField`'s 8–72 bounds, ours to hand over once. */
function generatedPassword(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * Grants a boat, right away — no token, no code, no second visit (D151).
 *
 * The bug this replaces: an invitee received a link, then had to receive a 6-digit code a second
 * time to open it — two sends that could each fail in transit, the same class of failure D76/D78
 * already fixed for sign-in and recovery, but never fixed here. And nothing distinguished one
 * invitee from another until they had clicked through, which is what made "on ne voit pas qui est
 * qui" true. Now the inviter grants the access and the account is created in the same call: there
 * is nothing left for the invitee to do but read their e-mail and sign in.
 *
 * **Who gets a password, and who doesn't.** A profile is looked up by e-mail first. None found:
 * a fresh account, with a generated password. One found *with no boat_members row anywhere*: an
 * account this function itself created on an earlier attempt whose e-mail never left (D151's own
 * retry path — `resendInvitation` below) — nobody could be relying on that password since it was
 * never delivered, so a new one is generated and written over it. One found *with* a boat_members
 * row somewhere: a real Xaman member already, on another boat — their password is never touched,
 * and the e-mail only tells them they now have this one too.
 *
 * **Who may grant what** is re-checked in the database (`grant_boat_access`, security definer):
 * an owner grants any role, an editor only a fresh pro/viewer, dated. Defence in depth (rule 2) —
 * the caller here has already applied the same rule in `inviteMember`, for the sentence that says
 * which half was wrong, but the database is what actually refuses it.
 */
async function provisionAndGrant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  values: { boatId: string; email: string; role: InvitationRole; validUntil: string | null },
): Promise<ActionResult<GrantedAccess>> {
  const { boatId, email, role, validUntil } = values;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("provisionAndGrant: no admin client", error);
    return fail("errors.unknown");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("email", email)
    .maybeSingle();

  let userId: string;
  let created = false;
  let password: string | null = null;

  if (!profile) {
    password = generatedPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error(`provisionAndGrant: account creation failed — ${error?.message}`);
      return fail("errors.unknown");
    }
    userId = data.user.id;
    created = true;
  } else {
    userId = profile.id;
    const { data: existingAccess } = await admin
      .from("boat_members")
      .select("boat_id")
      .eq("user_id", userId)
      .limit(1);
    // No boat anywhere: this profile has no working password anyone could be relying on — either
    // it is fresh, or an earlier attempt here created it and its e-mail never arrived.
    if (!existingAccess || existingAccess.length === 0) {
      password = generatedPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) {
        console.error(`provisionAndGrant: password reissue failed — ${error.message}`);
        return fail("errors.unknown");
      }
    }
  }

  const { error: grantError } = await supabase.rpc("grant_boat_access", {
    p_boat_id: boatId,
    p_user_id: userId,
    p_role: role,
    p_valid_until: validUntil,
  });
  if (grantError) return fail(dbErrorKey(grantError));

  const [{ data: boat }, { data: inviter }] = await Promise.all([
    supabase.from("boats").select("name").eq("id", boatId).maybeSingle(),
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return { data: null };
      return supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", data.user.id)
        .maybeSingle();
    }),
  ]);
  const t = await getTranslations("members.roles");
  const { subject, html, text } = credentialsEmail({
    email,
    password,
    boatName: boat?.name ?? "",
    inviterName: inviter?.full_name ?? inviter?.email ?? "",
    roleLabel: t(role),
    appUrl: publicEnv.appUrl,
  });
  const { sent } = await sendMail({ to: email, subject, html, text });

  revalidatePath(boatPath(boatId, "members"));
  return ok({ email, created, emailFailed: !sent, password: !sent ? password : null });
}

export async function inviteMember(input: unknown): Promise<ActionResult<GrantedAccess>> {
  const parsed = parseInput(inviteMemberSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, email, role, duration } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");

  // D28: an editor grants a pro or a viewer, never a peer and never an owner, and always with an
  // end date (≤ 90 days). `grant_boat_access` refuses the same thing; this only turns a bare
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
  return provisionAndGrant(supabase, { boatId, email, role, validUntil });
}

// E1-8 / D30, step 2: the new owner is granted `owner` right away; step 3 (leaveBoat) once done.
export async function inviteNewOwner(input: unknown): Promise<ActionResult<GrantedAccess>> {
  const parsed = parseInput(inviteNewOwnerSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");
  return provisionAndGrant(supabase, { ...parsed.data, role: "owner", validUntil: null });
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

// Cancels a still-pending row from before D151 (never any account, never any access to undo).
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
 * The four states of a legacy row, computed exactly as `boat_invitations_safe` computes them
 * (0023, 0031). The view is what the Membres screen reads; this is for the one caller that needs
 * the table itself, with the service key.
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
 * « Relancer », on a row left over from before D151 (docs/DATA-MODEL.md §3.6): converts it into
 * the account-and-access grant a fresh invite now creates directly, instead of resending the old
 * token link. The row is deleted once the message actually leaves — a live account with nobody
 * told the password is worse than a row that stays in « En attente » one more try, so a failed
 * send keeps the row (and the `emailFailed` password fallback offers it once, the same way
 * `inviteMember` does for a brand new one).
 */
export async function resendInvitation(input: unknown): Promise<ActionResult<GrantedAccess>> {
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
      "email, role, valid_until, accepted_at, revoked_at, expires_at, delivery_status, reminded_at",
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
    return fail("errors.invitation_address_refused");
  }
  if (remindedTooRecently(invitation.reminded_at)) {
    return fail("errors.invitation_reminded_recently");
  }

  const result = await provisionAndGrant(supabase, {
    boatId,
    email: invitation.email,
    role: invitation.role as InvitationRole,
    validUntil: invitation.valid_until,
  });
  if (!result.ok) return result;

  if (result.data.emailFailed) {
    // The account and the access both exist; only the message stayed behind. The row stays too,
    // marked as just tried, so « Relancer » can be pressed again without generating a second
    // password nobody needs.
    const { error: markError } = await admin
      .from("boat_invitations")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("boat_id", boatId);
    if (markError) console.error(`resendInvitation: reminder not recorded — ${markError.message}`);
  } else {
    const { error: deleteError } = await admin
      .from("boat_invitations")
      .delete()
      .eq("id", invitationId)
      .eq("boat_id", boatId);
    if (deleteError) console.error(`resendInvitation: row not cleared — ${deleteError.message}`);
  }

  return result;
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
