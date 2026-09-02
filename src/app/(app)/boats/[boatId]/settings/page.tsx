import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CategoriesManager, type CategoryRow } from "@/components/categories/CategoriesManager";
import { PageHeader } from "@/components/common/PageHeader";
import { DeleteBoatCard } from "@/components/settings/DeleteBoatCard";
import { ExportCard } from "@/components/settings/ExportCard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { TransferBoatCard, type OwnerInvitation } from "@/components/settings/TransferBoatCard";
import { Button } from "@/components/ui/button";
import { can, type BoatRole } from "@/lib/permissions";
import { checklistSetupPath, logsPath, reportPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

// Boat settings (E2-5): categories, the tools of the logbook, then the owner-only zone.
export default async function SettingsPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: boat }, { data: categories }, { data: items }, { data: auth }] =
    await Promise.all([
      supabase.rpc("boat_role", { p_boat_id: boatId }),
      supabase.from("boats").select("id, name").eq("id", boatId).maybeSingle(),
      supabase
        .from("boat_categories")
        .select("id, name, color, icon, sort_order, is_active, updated_at")
        .eq("boat_id", boatId)
        .order("sort_order"),
      supabase
        .from("checklist_items")
        .select("category_id")
        .eq("boat_id", boatId)
        .eq("is_active", true),
      supabase.auth.getUser(),
    ]);
  if (!role || !boat) notFound();
  const boatRole = role as BoatRole;
  if (!can(boatRole, "write")) notFound();
  const isOwner = can(boatRole, "deleteBoat");

  const counts = new Map<string, number>();
  for (const item of items ?? []) {
    counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
  }
  const rows: CategoryRow[] = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    isActive: category.is_active,
    activeItems: counts.get(category.id) ?? 0,
    updatedAt: category.updated_at,
  }));

  // Transfer (E1-8): other owners and pending owner invitations
  let otherOwners = 0;
  let ownerInvitations: OwnerInvitation[] = [];
  if (isOwner) {
    const [{ count }, { data: invitations }] = await Promise.all([
      supabase
        .from("boat_members")
        .select("user_id", { count: "exact", head: true })
        .eq("boat_id", boatId)
        .eq("role", "owner")
        .neq("user_id", auth.user?.id ?? ""),
      supabase
        .from("boat_invitations_safe")
        .select("id, email, expires_at, role, status")
        .eq("boat_id", boatId)
        .eq("role", "owner")
        .eq("status", "pending"),
    ]);
    otherOwners = count ?? 0;
    ownerInvitations = (invitations ?? []).map((invitation) => ({
      id: invitation.id ?? "",
      email: invitation.email ?? "",
      expiresAt: invitation.expires_at ?? "",
    }));
  }

  const t = await getTranslations("settings");
  const tcat = await getTranslations("categories");

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={t("title")} subtitle={boat.name} />
      <SettingsSection title={t("sections.categories")} description={tcat("description")}>
        <CategoriesManager boatId={boatId} categories={rows} canWrite />
      </SettingsSection>
      <SettingsSection title={t("sections.recalibrate")} description={t("recalibrate.description")}>
        <div>
          <Button asChild variant="outline">
            <Link href={checklistSetupPath(boatId) as Route}>{t("recalibrate.action")}</Link>
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection title={t("sections.import")} description={t("import.description")}>
        <div>
          <Button asChild variant="outline">
            <Link href={logsPath(boatId, { review: 1 }) as Route}>{t("import.action")}</Link>
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection title={t("sections.export")} description={t("export.description")}>
        <ExportCard boatId={boatId} />
      </SettingsSection>
      <SettingsSection title={t("sections.report")} description={t("report.description")}>
        <div>
          <Button asChild variant="outline">
            <Link href={reportPath(boatId) as Route}>{t("report.action")}</Link>
          </Button>
        </div>
      </SettingsSection>
      {isOwner ? (
        <>
          <SettingsSection title={t("sections.transfer")} description={t("transfer.description")}>
            <TransferBoatCard
              boatId={boatId}
              boatName={boat.name}
              otherOwners={otherOwners}
              pendingInvitations={ownerInvitations}
            />
          </SettingsSection>
          <SettingsSection title={t("sections.danger")}>
            <DeleteBoatCard boatId={boatId} boatName={boat.name} />
          </SettingsSection>
        </>
      ) : null}
    </div>
  );
}
