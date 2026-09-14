import { notFound } from "next/navigation";

import { BoatIdentity } from "@/components/boat/BoatIdentity";
import { BoatTabs } from "@/components/boat/BoatTabs";
import { isBoatTab, type BoatTab } from "@/components/boat/tabs";
import { EnginesTab, type EngineSummary } from "@/components/engines/EnginesTab";
import type { BoatModelData } from "@/components/boat-3d/BoatModel3D";
import { specsRecord, toBoatModelData } from "@/lib/boat-3d/data";
import { EquipmentTab } from "@/components/equipment/EquipmentTab";
import { applyStockFilter, countLowStock, type StockFilter } from "@/lib/parts";
import { can, type BoatRole } from "@/lib/permissions";
import { inboundDomain } from "@/lib/inbox/receive";
import { boatModels } from "@/lib/queries/boat-models";
import { loadStockItems, toRestockList } from "@/lib/queries/stock";
import { inboxAddress } from "@/lib/schemas/inbox";
import { readBoatRole, readBoatRow } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

/**
 * Boat screen (tab 4, D34, D37): the identity is the heading, then two lists — the engines
 * and, with the equipment, the spare-parts stock. The tab is kept in the URL.
 */
export default async function BoatPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ tab?: string; reading?: string; low?: string }>;
}) {
  const [{ boatId }, { tab, reading, low }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [
    { data: boat },
    { data: role },
    { data: engines },
    { data: currentHours },
    { data: linkedItems },
    { data: equipment },
    { data: categories },
    { data: statuses },
    allParts,
    models,
  ] = await Promise.all([
    readBoatRow(boatId),
    readBoatRole(boatId),
    supabase
      .from("engines")
      .select(
        "id, label, position, propulsion, brand, model, installed_at, is_active, tracks_hours",
      )
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
      .select(
        "id, name, brand, model, quantity, category_id, installed_at, removed_at, external_ref, specs",
      )
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name"),
    supabase
      .from("boat_categories")
      // `external_ref` is what routes a system to a place of the 3D model (E2-8): it is the
      // template's own word (`sails_rigging`…), stable across boats, unlike the display name.
      .select("id, name, color, icon, external_ref")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    // What is due, per point: the model turns it into « ce qu'il y a à faire » on each place.
    supabase
      .from("checklist_item_status")
      .select(
        "id, label, status, days_remaining, hours_remaining, category_id, engine_id, engine_tracks_hours",
      )
      .eq("boat_id", boatId),
    // The spare-parts stock lives in this tab now (D34): read it with the equipment, enriched
    // with its system and supplier names by the shared loader the checklist screen uses too.
    loadStockItems(supabase, boatId),
    // The catalogue (D69): suggestions in the identity form, and the dimensions of a model tapped
    // there. A few hundred short rows, read alongside the rest rather than after it.
    boatModels(supabase),
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

  // The boat's own address (D91), when a receiving domain is configured.
  const domain = inboundDomain();

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
    propulsion: engine.propulsion,
    brand: engine.brand,
    model: engine.model,
    installedAt: engine.installed_at,
    isActive: engine.is_active,
    tracksHours: engine.tracks_hours,
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
    externalRef: item.external_ref,
    // `specs` is what tells the 3D model this boat has 88 m² of mainsail and its panels on the
    // davits (E2-8): free pairs, read as text, never trusted to be of any shape.
    specs: specsRecord(item.specs),
  }));

  const stockFilter: StockFilter = low === "1" ? "low" : "all";

  /**
   * The 3D model (E2-8, D117): the boat's own shape, its systems and what each of them owes.
   * The assembly is shared with « À bord », which shows the same model (D133) — two mappings
   * would have drawn two different boats from one carnet.
   */
  const model: BoatModelData = toBoatModelData({
    boat,
    engines: engines ?? [],
    categories: categories ?? [],
    equipment: equipment ?? [],
    points: statuses ?? [],
  });

  // `?tab=identity` still arrives from an old link: it now lands on the default list, with
  // the identity right above it (D37).
  // Équipements is the default (D39); an explicit `?tab=` still wins.
  const activeTab: BoatTab = isBoatTab(tab) ? tab : "equipment";

  return (
    <div className="flex flex-col gap-6">
      <BoatIdentity
        boat={boat}
        canEdit={can(boatRole, "write")}
        templateName={template?.name ?? null}
        models={models}
        inboxAddress={domain ? inboxAddress(boat.name, boat.inbox_token, domain) : null}
      />
      <BoatTabs
        boatId={boatId}
        active={activeTab}
        counts={{
          engines: engineRows.filter((engine) => engine.isActive).length,
          equipment: equipmentRows.filter((item) => !item.removedAt).length,
        }}
      />
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
          stock={{
            parts: applyStockFilter(allParts, stockFilter),
            lowParts: toRestockList(allParts),
            filter: stockFilter,
            lowCount: countLowStock(allParts),
            totalCount: allParts.length,
          }}
          model={model}
          boatName={boat.name}
          canWrite={can(boatRole, "write")}
        />
      ) : null}
    </div>
  );
}
