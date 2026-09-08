import { notFound } from "next/navigation";

import { ChecklistItemForm } from "@/components/checklist/ChecklistItemForm";
import { can, type BoatRole } from "@/lib/permissions";
import { readBoatRole } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

export default async function EditChecklistItemPage({
  params,
}: {
  params: Promise<{ boatId: string; categoryId: string; itemId: string }>;
}) {
  const { boatId, categoryId, itemId } = await params;
  const supabase = await createClient();
  const [
    { data: role },
    { data: item },
    { data: categories },
    { data: engines },
    { data: items },
    { count },
  ] = await Promise.all([
    readBoatRole(boatId),
    supabase
      .from("checklist_items")
      .select("*")
      .eq("id", itemId)
      .eq("boat_id", boatId)
      .maybeSingle(),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("engines")
      .select("id, label, tracks_hours")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("checklist_items")
      .select("label")
      .eq("boat_id", boatId)
      .eq("category_id", categoryId)
      .eq("is_active", true),
    supabase
      .from("checklist_completions")
      .select("id", { count: "exact", head: true })
      .eq("checklist_item_id", itemId),
  ]);
  if (!role || !can(role as BoatRole, "write") || !item) notFound();
  return (
    <ChecklistItemForm
      boatId={boatId}
      categories={categories ?? []}
      engines={(engines ?? []).map((engine) => ({
        id: engine.id,
        label: engine.label,
        tracksHours: engine.tracks_hours,
      }))}
      item={{
        id: item.id,
        categoryId: item.category_id,
        label: item.label,
        description: item.description,
        intervalMonths: item.interval_months,
        intervalHours: item.interval_hours,
        engineId: item.engine_id,
        actions: Array.isArray(item.actions) ? item.actions.map(String) : [],
        anchorDate: item.anchor_date,
        isActive: item.is_active,
        completionsCount: count ?? 0,
        updatedAt: item.updated_at,
      }}
      defaultCategoryId={item.category_id}
      existingLabels={(items ?? []).map((row) => row.label)}
    />
  );
}
