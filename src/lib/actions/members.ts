"use server";

import { randomInt } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { credentialsEmail } from "@/lib/email/credentials";
import { mailerConfigured, sendMail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import { addDays, toIsoDate } from "@/lib/numbers";
import { EDITOR_ASSIGNABLE_ROLES } from "@/lib/permissions";
import {
  changeMemberRoleSchema,
  extendMemberAccessSchema,
  inviteMemberSchema,
  inviteNewOwnerSchema,
  leaveBoatSchema,
  removeMemberSchema,
  reissueCredentialsSchema,
} from "@/lib/schemas/members";
import { boatPath } from "@/lib/queries/boat-routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type InvitationRole = "owner" | "editor" | "pro" | "viewer";

export type IssuedCredentials = {
  email: string;
  /** The row exists either way; only the message may have stayed behind. */
  emailFailed: boolean;
};

/**
 * A password a person can actually type on an iPad, out loud if need be: 6 random digits, no
 * letters, no symbols, nothing that reads ambiguously (0/O, 1/l never come up because there are
 * no letters at all).
 *
 * There is no other requirement on it. It is not meant to be kept — the owner reissues one
 * whenever they need to (a fresh reissue is exactly a "relance"), and the member can set their
 * own from their profile once signed in.
 */
function generateSimplePassword(): string {
  let digits = "";
  for (let i = 0; i < 6; i += 1) digits += randomInt(0, 10).toString();
  return digits;
}

/**
 * Instant membership (D151): no invitation row, no token, no sign-in code. The account exists
 * (freshly created, or already there — someone re-invited, or a member whose credentials are
 * being reissued) the moment this returns, with a membership on this boat, and one e-mail on its
 * way carrying the address and a fresh password.
 *
 * "Relancer" is deliberately the same code path as a first invite: calling this again for an
 * address that already has an account never creates a duplicate, it resets the password and
 * sends it again. That is the whole answer to "quand je relance ces mecs, ça envoie un nouveau
 * mail avec le nouveau mot de passe".
 */
async function issueCredentials(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  values: { boatId: string; email: string; role: InvitationRole; validUntil: string | null },
): Promise<ActionResult<IssuedCredentials>> {
  const { boatId, email, role, validUntil } = values;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("issueCredentials: no admin client", error);
    return fail("errors.unknown");
  }

  const password = generateSimplePassword();

  let authUserId: string | null = null;
  {
    // @supabase/supabase-js exposes a dedicated lookup on newer versions; fall back to scanning
    // pages of listUsers on older ones so this keeps working either way.
    const adminApi = admin.auth.admin as unknown as {
      getUserByEmail?: (email: string) => Promise<{ data: { user: { id: string } | null } }>;
    };
    if (typeof adminApi.getUserByEmail === "function") {
      const { data } = await adminApi.getUserByEmail(email);
      authUserId = data.user?.id ?? null;
    } else {
      for (let page = 1; authUserId === null; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error || !data || data.users.length === 0) break;
        const match = data.users.find((u) => u.email?.toLowerCase() === email);
        if (match) authUserId = match.id;
        if (data.users.length < 200) break;
      }
    }
  }

  if (authUserId) {
    const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, { password });
    if (updateError) {
      console.error(`issueCredentials: password reset refused — ${updateError.message}`);
      return fail("errors.unknown");
    }
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      console.error(`issueCredentials: account creation refused — ${createError?.message}`);
      return fail("errors.unknown");
    }
    authUserId = created.user.id;
  }

  const { error: memberError } = await supabase.from("boat_members").upsert(
    {
      boat_id: boatId,
      user_id: authUserId,
      role,
      valid_until: validUntil,
      invited_by: userId,
    },
    { onConflict: "boat_id,user_id" },
  );
  if (memberError) return fail(dbErrorKey(memberError));

  const [{ data: boat }, { data: inviter }] = await Promise.all([
    supabase.from("boats").select("name").eq("id", boatId).maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
  ]);
  const t = await getTranslations("members.roles");

  let emailFailed = true;
  if (mailerConfigured()) {
    const { subject, html } = credentialsEmail({
      email,
      password,
      appUrl: publicEnv.appUrl,
      boatName: boat?.name ?? "",
      inviterName: inviter?.full_name ?? inviter?.email ?? "",
      roleLabel: t(role),
    });
    const result = await sendMail({ to: email, subject, html });
    emailFailed = !result.sent;
  } else {
    console.error("issueCredentials: no mailer configured, credentials were not sent");
  }

  revalidatePath(boatPath(boatId, "members"));
  return ok({ email, emailFailed });
}

export async function inviteMember(input: unknown): Promise<ActionResult<IssuedCredentials>> {
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
  // D89: an owner never expires. A proprietor whose access lapses on a date is not a proprietor,
  // and the form hides the question rather than asking it — this is what makes that true.
  const validUntil =
    role === "owner" || duration === "unlimited" ? null : addDays(toIsoDate(), Number(duration));
  return issueCredentials(supabase, user.id, { boatId, email, role, validUntil });
}

// E1-8 / D30, step 2: the new owner is invited as `owner`; step 3 (leaveBoat) once accepted.
export async function inviteNewOwner(input: unknown): Promise<ActionResult<IssuedCredentials>> {
  const parsed = parseInput(inviteNewOwnerSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");
  return issueCredentials(supabase, user.id, { ...parsed.data, role: "owner", validUntil: null });
}

/**
 * "Relancer" a member (D151): a fresh password, sent by the same e-mail. Owner only — the same
 * right that manages members in every other way.
 */
export async function reissueCredentials(input: unknown): Promise<ActionResult<IssuedCredentials>> {
  const parsed = parseInput(reissueCredentialsSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, userId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");
  const { data: callerRole } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (callerRole !== "owner") return fail("errors.forbidden");

  const { data: member, error } = await supabase
    .from("boat_members")
    .select("role, valid_until, profiles!boat_members_user_id_fkey(email)")
    .eq("boat_id", boatId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return fail(dbErrorKey(error));
  const email = member?.profiles?.email;
  const role = member?.role;
  // `renter` is a V2 role, never actually assigned in V1 (D89) — this only satisfies the type.
  if (!member || !email || !role || role === "renter") return fail("errors.forbidden");

  return issueCredentials(supabase, user.id, {
    boatId,
    email,
    role,
    validUntil: member.valid_until,
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
