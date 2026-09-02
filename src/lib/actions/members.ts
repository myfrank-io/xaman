"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { publicEnv } from "@/lib/env";
import { addDays, toIsoDate } from "@/lib/numbers";
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

// Invite by e-mail: the row is inserted with the user's client (RLS: owner only), then the token is
// read with the service key and the e-mail goes out through Supabase Auth (invite template for new
// accounts, magic link for existing ones), redirecting to /invite/[token].
type InvitationRole = "owner" | "editor" | "pro" | "viewer";

// Inserts the row with the user's client (RLS decides who may invite whom), reads nothing
// sensitive back, and sends the e-mail through Supabase Auth (invite template for new accounts,
// magic link for existing ones), landing on /invite/[token]. Returns the link for sharing.
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

  try {
    const admin = createAdminClient();
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data,
      redirectTo,
    });
    if (inviteError) {
      // already registered: send a magic link that lands on the invitation page
      const { error: otpError } = await admin.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });
      if (otpError) return fail("errors.invitation_email");
    }
  } catch {
    return fail("errors.invitation_email");
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

  // D28: an editor invites pro/viewer only, always with an end date (≤ 90 days).
  const { data: inviterRole } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (inviterRole === "editor" && (role === "editor" || duration === "unlimited")) {
    return fail("errors.invitation_duration_required");
  }
  const validUntil = duration === "unlimited" ? null : addDays(toIsoDate(), Number(duration));
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
