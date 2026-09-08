import { notFound } from "next/navigation";

import { ChecklistItemForm } from "@/components/checklist/ChecklistItemForm";
import { can, type BoatRole } from "@/lib/permissions";
import { readBoatRole } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

export default async function NewChecklistItemPage({
  params,
}: {
  params: Promise<{ boatId: string; categoryId: string }>;
}) {
  const { boatId, categoryId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: categories }, { data: engines }, { data: items }] =
    await Promise.all([
      readBoatRole(boatId),
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
    ]);
  if (!role || !can(role as BoatRole, "write")) notFound();
  if (!(categories ?? []).some((category) => category.id === categoryId)) notFound();
  return (
    <ChecklistItemForm
      boatId={boatId}
      categories={categories ?? []}
      engines={(engines ?? []).map((engine) => ({
        id: engine.id,
        label: engine.label,
        tracksHours: engine.tracks_hours,
      }))}
      item={null}
      defaultCategoryId={categoryId}
      existingLabels={(items ?? []).map((item) => item.label)}
    />
  );
}
