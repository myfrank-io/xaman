import type { SupabaseClient } from "@supabase/supabase-js";

import type { TemplateOption } from "@/lib/boat-onboarding";
import type { Database } from "@/types/database";

export type BoatPlanChoice = {
  templates: TemplateOption[];
  /** The generic model matching the hull, so the picker opens on the sensible answer. */
  suggestedTemplateId: string | null;
};

/**
 * Whether this boat still has a maintenance plan to choose, and what it may choose from (D65).
 *
 * Creation gives a boat its systems and leaves `checklist_template_id` null on purpose — identity
 * and plan are two questions asked at two moments. Reading that null here is what turns the
 * Checklist screen into the second question, and returning `null` from this function is what
 * makes the offer disappear once the choice is made.
 *
 * The registry comes from `checklist_template_catalog`, which is `security_invoker`: what a
 * person may instantiate is decided by `checklist_templates_select`, not by this query.
 */
export async function boatPlanChoice(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<BoatPlanChoice | null> {
  const { data: boat } = await supabase
    .from("boats")
    .select("type, checklist_template_id")
    .eq("id", boatId)
    .maybeSingle();
  if (!boat || boat.checklist_template_id) return null;

  const { data } = await supabase
    .from("checklist_template_catalog")
    .select("id, name, builder, model, boat_type, category_count, item_count")
    .order("builder", { nullsFirst: false })
    .order("name");

  const templates: TemplateOption[] = (data ?? [])
    .filter((row): row is typeof row & { id: string; name: string } => !!row.id && !!row.name)
    .map((row) => ({
      id: row.id,
      name: row.name,
      builder: row.builder,
      model: row.model,
      boatType: row.boat_type,
      categoryCount: row.category_count ?? 0,
      itemCount: row.item_count ?? 0,
    }));
  if (templates.length === 0) return null;

  return { templates, suggestedTemplateId: suggestFor(templates, boat.type) };
}

/**
 * Mirrors `generic_template_for_boat_type` (0017): a trimaran sails like a catamaran, a rigid
 * inflatable is a small motor boat. It is only a pre-selection — every model stays choosable.
 */
export function suggestFor(
  templates: TemplateOption[],
  boatType: Database["public"]["Enums"]["boat_type"],
): string | null {
  const generic = templates.filter((t) => t.builder === null && t.model === null);
  const wanted: Database["public"]["Enums"]["boat_type"] =
    boatType === "trimaran"
      ? "catamaran"
      : boatType === "rib"
        ? "motor"
        : boatType === "other"
          ? "monohull_sail"
          : boatType;
  return generic.find((t) => t.boatType === wanted)?.id ?? generic[0]?.id ?? null;
}
