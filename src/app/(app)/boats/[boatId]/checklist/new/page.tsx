import { notFound } from "next/navigation";

import { ChecklistItemForm } from "@/components/checklist/ChecklistItemForm";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * A checklist point with no category chosen yet (A9).
 *
 * A point does need a category, but that is a field of the form, not a condition for opening
 * it: demanding it in the URL made the « + » of the checklist root a dead end. Arriving from a
 * category still pre-selects it — that route is unchanged.
 */
export default async function NewChecklistItemPage({
  params,
}: {
  params: Promise<{ boatId: string }>;
}) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: categories }, { data: engines }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("engines")
      .select("id, label")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (!role || !can(role as BoatRole, "write")) notFound();
  return (
    <ChecklistItemForm
      boatId={boatId}
      categories={categories ?? []}
      engines={engines ?? []}
      item={null}
      defaultCategoryId=""
      // The duplicate-label warning compares within one category, and none is chosen yet: it
      // comes back as soon as the person picks one from the category's own « Ajouter un point ».
      existingLabels={[]}
    />
  );
}
