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

  const token = randomBytes(32).toString("base64url");
  const { data: invitation, error } = await supabase
    .from("boat_invitations")
    .insert({ boat_id: boatId, email, role, token, invited_by: user.id, valid_until: validUntil })
    .select("id")
    .single();
  if (error || !invitation) return fail(dbErrorKey(error ?? { message: "insert failed" }));

  // Send the e-mail (best effort: the invitation exists and can be re-sent from the members page)
  const [{ data: boat }, { data: inviter }] = await Promise.all([
    supabase.from("boats").select("name").eq("id", boatId).maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
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
