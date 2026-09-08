import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { InviteMemberDialog } from "@/components/members/InviteMemberDialog";
import { InvitationsList } from "@/components/members/InvitationsList";
import { MembersList } from "@/components/members/MembersList";
import { refreshInvitationDeliveries } from "@/lib/email/delivery";
import { toDeliveryReason, toDeliveryStatus } from "@/lib/email/delivery-status";
import type { InvitationStatus } from "@/lib/invitations";
import { can, type BoatRole } from "@/lib/permissions";
import { readBoatRole, readBoatRow } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

const INVITATION_COLUMNS =
  "id, email, role, status, expires_at, valid_until, invited_by_name, created_at";

type InvitationSource = {
  id: string | null;
  email: string | null;
  role: BoatRole | null;
  status: string | null;
  expires_at: string | null;
  valid_until: string | null;
  invited_by_name: string | null;
  delivery_status: string | null;
  delivery_reason: string | null;
  reminded_at: string | null;
  reminder_count: number | null;
};

/**
 * The invitations, with what became of their e-mail where the database can say (D79).
 *
 * The retry is not defensive dressing, it is the deploy order: the schema is pushed by hand
 * (rule 3), so a build reaches production before its migration does. In that window
 * `delivery_status` does not exist yet, PostgREST answers `42703`, and supabase-js hands back
 * `data: null` — which read straight means « no invitations » and takes the whole section off
 * the screen. Nobody is told; the owner sees a crew and no pending invitation, exactly as if
 * there were none. That is what D60 forbids, and it is what happened on the first deploy of
 * D79.
 *
 * So a refused select falls back to the columns that have always existed: the list comes back,
 * the delivery reads as unknown, and the server log names the column that is missing. The
 * reminders of D109 (`0030`) join the same select, and the same fallback: an invitation nobody
 * has relaunched yet is what the screen shows in the meantime.
 */
async function loadInvitations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boatId: string,
): Promise<InvitationSource[]> {
  const full = await supabase
    .from("boat_invitations_safe")
    .select(`${INVITATION_COLUMNS}, delivery_status, delivery_reason, reminded_at, reminder_count`)
    .eq("boat_id", boatId)
    .order("created_at", { ascending: false });
  if (!full.error) return full.data;

  console.error(`members: invitations read without their delivery — ${full.error.message}`);
  const { data } = await supabase
    .from("boat_invitations_safe")
    .select(INVITATION_COLUMNS)
    .eq("boat_id", boatId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((row) => ({
    ...row,
    delivery_status: null,
    delivery_reason: null,
    reminded_at: null,
    reminder_count: 0,
  }));
}

// Owner: manage members and invitations. Editor: read-only list. Others: 404 (SPEC §4.3).
export default async function MembersPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: userData }] = await Promise.all([
    readBoatRole(boatId),
    supabase.auth.getUser(),
  ]);
  const boatRole = role as BoatRole | null;
  if (!boatRole || !can(boatRole, "write")) notFound();
  const isOwner = can(boatRole, "manageMembers");

  const [{ data: members }, invitations, { data: boat }] = await Promise.all([
    supabase
      .from("boat_members")
      .select(
        "user_id, role, valid_until, created_at, profiles!boat_members_user_id_fkey(full_name, email)",
      )
      .eq("boat_id", boatId)
      .order("created_at"),
    isOwner ? loadInvitations(supabase, boatId) : Promise.resolve([] as InvitationSource[]),
    readBoatRow(boatId),
  ]);

  // D79: the invitations still waiting are the ones worth asking the mailer about. Costs nothing
  // once each has an answer — delivered and bounced are final, and a fresh answer is not asked
  // for twice in a minute — so this is a no-op on every visit but the one that matters.
  const fresh = await refreshInvitationDeliveries(
    invitations.filter((i) => i.status === "pending" && i.id).map((i) => i.id ?? ""),
  );

  const t = await getTranslations("members");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <InviteMemberDialog
            boatId={boatId}
            boatName={boat?.name ?? ""}
            inviterRole={isOwner ? "owner" : "editor"}
          />
        }
      />
      <MembersList
        boatId={boatId}
        currentUserId={userData.user?.id ?? ""}
        canManage={isOwner}
        members={(members ?? []).map((m) => ({
          userId: m.user_id,
          role: m.role,
          validUntil: m.valid_until,
          fullName: m.profiles?.full_name ?? null,
          email: m.profiles?.email ?? "",
        }))}
      />
      {isOwner ? (
        <InvitationsList
          boatId={boatId}
          boatName={boat?.name ?? ""}
          invitations={invitations.map((i) => {
            const polled = fresh.get(i.id ?? "");
            const status = polled?.status ?? toDeliveryStatus(i.delivery_status);
            return {
              id: i.id ?? "",
              email: i.email ?? "",
              role: i.role ?? "viewer",
              status: (i.status ?? "pending") as InvitationStatus,
              expiresAt: i.expires_at ?? "",
              validUntil: i.valid_until ?? null,
              invitedByName: i.invited_by_name ?? null,
              delivery: status
                ? { status, reason: polled?.reason ?? toDeliveryReason(i.delivery_reason) }
                : null,
              remindedAt: i.reminded_at ?? null,
              reminderCount: i.reminder_count ?? 0,
            };
          })}
        />
      ) : null}
    </div>
  );
}
