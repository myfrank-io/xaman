import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { InviteMemberDialog } from "@/components/members/InviteMemberDialog";
import { MembersList } from "@/components/members/MembersList";
import { can, type BoatRole } from "@/lib/permissions";
import { readBoatRole } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

// Owner: manage members (D151: invite = account created instantly, credentials e-mail sent).
// Editor: read-only list. Others: 404 (SPEC §4.3).
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

  const { data: members } = await supabase
    .from("boat_members")
    .select(
      "user_id, role, valid_until, created_at, profiles!boat_members_user_id_fkey(full_name, email, last_sign_in_at)",
    )
    .eq("boat_id", boatId)
    .order("created_at");

  const t = await getTranslations("members");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <InviteMemberDialog boatId={boatId} inviterRole={isOwner ? "owner" : "editor"} />
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
          lastSignInAt: m.profiles?.last_sign_in_at ?? null,
        }))}
      />
    </div>
  );
}
