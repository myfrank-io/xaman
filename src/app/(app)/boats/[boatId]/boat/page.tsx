import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BoatIdentity } from "@/components/boat/BoatIdentity";
import { BOAT_TABS, BoatTabs, type BoatTab } from "@/components/boat/BoatTabs";
import { PageHeader } from "@/components/common/PageHeader";
import { EnginesTab, type EngineSummary } from "@/components/engines/EnginesTab";
import { EquipmentTab } from "@/components/equipment/EquipmentTab";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

// Boat screen (tab 4): identity, engines and equipment, the tab kept in the URL.
export default async function BoatPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ tab?: string; reading?: string }>;
}) {
  const [{ boatId }, { tab, reading }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [
    { data: boat },
    { data: role },
    { data: engines },
    { data: currentHours },
    { data: linkedItems },
    { data: equipment },
    { data: categories },
  ] = await Promise.all([
    supabase.from("boats").select("*").eq("id", boatId).maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("engines")
      .select("id, label, position, brand, model, installed_at, is_active")
      .eq("boat_id", boatId)
      .order("sort_order")
      .order("label"),
    supabase.from("engine_current_hours").select("engine_id, hours, read_at").eq("boat_id", boatId),
    supabase
      .from("checklist_items")
      .select("engine_id")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .not("engine_id", "is", null),
    supabase
      .from("equipment")
      .select("id, name, brand, model, quantity, category_id, installed_at, removed_at")
      .eq("boat_id", boatId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (!boat || !role) notFound();
  const boatRole = role as BoatRole;

  const { data: template } = boat.checklist_template_id
    ? await supabase
        .from("checklist_templates")
        .select("name")
        .eq("id", boat.checklist_template_id)
        .maybeSingle()
    : { data: null };

  const hoursByEngine = new Map(
    (currentHours ?? []).map((row) => [row.engine_id, { hours: row.hours, readAt: row.read_at }]),
  );
  const linkedByEngine = new Map<string, number>();
  for (const row of linkedItems ?? []) {
    if (row.engine_id)
      linkedByEngine.set(row.engine_id, (linkedByEngine.get(row.engine_id) ?? 0) + 1);
  }
  const engineRows: EngineSummary[] = (engines ?? []).map((engine) => ({
    id: engine.id,
    label: engine.label,
    position: engine.position,
    brand: engine.brand,
    model: engine.model,
    installedAt: engine.installed_at,
    isActive: engine.is_active,
    hours: hoursByEngine.get(engine.id)?.hours ?? null,
    readAt: hoursByEngine.get(engine.id)?.readAt ?? null,
    linkedItems: linkedByEngine.get(engine.id) ?? 0,
  }));
  const equipmentRows = (equipment ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    brand: item.brand,
    model: item.model,
    quantity: item.quantity,
    categoryId: item.category_id,
    installedAt: item.installed_at,
    removedAt: item.removed_at,
  }));

  const activeTab: BoatTab = BOAT_TABS.includes(tab as BoatTab)
    ? (tab as BoatTab)
    : engineRows.some((engine) => engine.isActive)
      ? "engines"
      : "identity";

  const tt = await getTranslations("boatType");
  const subtitle = [
    [boat.model, boat.hull_number ? `#${boat.hull_number}` : null].filter(Boolean).join(" "),
    boat.builder,
    tt(boat.type),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={boat.name} subtitle={subtitle} />
      <BoatTabs
        boatId={boatId}
        active={activeTab}
        counts={{
          engines: engineRows.filter((engine) => engine.isActive).length,
          equipment: equipmentRows.filter((item) => !item.removedAt).length,
        }}
      />
      {activeTab === "identity" ? (
        <BoatIdentity
          boat={boat}
          canEdit={can(boatRole, "write")}
          templateName={template?.name ?? null}
        />
      ) : null}
      {activeTab === "engines" ? (
        <EnginesTab
          boatId={boatId}
          engines={engineRows}
          canWrite={can(boatRole, "write")}
          canContribute={can(boatRole, "contribute")}
          openReading={reading === "1"}
        />
      ) : null}
      {activeTab === "equipment" ? (
        <EquipmentTab
          boatId={boatId}
          items={equipmentRows}
          categories={categories ?? []}
          canWrite={can(boatRole, "write")}
        />
      ) : null}
    </div>
  );
}
