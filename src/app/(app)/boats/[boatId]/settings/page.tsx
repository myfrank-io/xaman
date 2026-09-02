import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CategoriesManager, type CategoryRow } from "@/components/categories/CategoriesManager";
import { PageHeader } from "@/components/common/PageHeader";
import { DeleteBoatCard } from "@/components/settings/DeleteBoatCard";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

// Boat settings (E2-5): categories, then the blocks delivered by later lots, then the danger zone.
export default async function SettingsPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: boat }, { data: categories }, { data: items }] = await Promise.all(
    [
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
    ],
  );
  if (!role || !boat) notFound();
  const boatRole = role as BoatRole;
  if (!can(boatRole, "write")) notFound();

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

  const t = await getTranslations("settings");
  const tcat = await getTranslations("categories");

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title={t("title")} subtitle={boat.name} />
      <SettingsSection title={t("sections.categories")} description={tcat("description")}>
        <CategoriesManager boatId={boatId} categories={rows} canWrite />
      </SettingsSection>
      <SettingsSection
        title={t("sections.recalibrate")}
        description={t("recalibrate.description")}
        soon={t("soon")}
      />
      <SettingsSection
        title={t("sections.import")}
        description={t("import.description")}
        soon={t("soon")}
      />
      <SettingsSection
        title={t("sections.export")}
        description={t("export.description")}
        soon={t("soon")}
      />
      <SettingsSection
        title={t("sections.report")}
        description={t("report.description")}
        soon={t("soon")}
      />
      {can(boatRole, "deleteBoat") ? (
        <>
          <SettingsSection
            title={t("sections.transfer")}
            description={t("transfer.description")}
            soon={t("soon")}
          />
          <SettingsSection title={t("sections.danger")}>
            <DeleteBoatCard boatId={boatId} boatName={boat.name} />
          </SettingsSection>
        </>
      ) : null}
    </div>
  );
}
