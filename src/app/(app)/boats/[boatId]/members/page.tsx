import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { InviteMemberDialog } from "@/components/members/InviteMemberDialog";
import { InvitationsList, type InvitationStatus } from "@/components/members/InvitationsList";
import { MembersList } from "@/components/members/MembersList";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

// Owner: manage members and invitations. Editor: read-only list. Others: 404 (SPEC §4.3).
export default async function MembersPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: userData }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase.auth.getUser(),
  ]);
  const boatRole = role as BoatRole | null;
  if (!boatRole || !can(boatRole, "write")) notFound();
  const isOwner = can(boatRole, "manageMembers");

  const [{ data: members }, { data: invitations }, { data: boat }] = await Promise.all([
    supabase
      .from("boat_members")
      .select(
        "user_id, role, valid_until, created_at, profiles!boat_members_user_id_fkey(full_name, email)",
      )
      .eq("boat_id", boatId)
      .order("created_at"),
    isOwner
      ? supabase
          .from("boat_invitations_safe")
          .select("id, email, role, status, expires_at, valid_until, invited_by_name, created_at")
          .eq("boat_id", boatId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("boats").select("name").eq("id", boatId).maybeSingle(),
  ]);

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
          invitations={(invitations ?? []).map((i) => ({
            id: i.id ?? "",
            email: i.email ?? "",
            role: i.role ?? "viewer",
            status: (i.status ?? "pending") as InvitationStatus,
            expiresAt: i.expires_at ?? "",
            validUntil: i.valid_until ?? null,
            invitedByName: i.invited_by_name ?? null,
          }))}
        />
      ) : null}
    </div>
  );
}
