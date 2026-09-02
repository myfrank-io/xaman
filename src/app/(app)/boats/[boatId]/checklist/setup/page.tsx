import { notFound } from "next/navigation";

import { StartupWizard, type WizardCategory } from "@/components/checklist/StartupWizard";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function ChecklistSetupPage({
  params,
}: {
  params: Promise<{ boatId: string }>;
}) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [
    { data: role },
    { data: engines },
    { data: hours },
    { data: categories },
    { data: items },
  ] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("engines")
      .select("id, label")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("engine_current_hours").select("engine_id, hours, read_at").eq("boat_id", boatId),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("checklist_items")
      .select("id, label, category_id, interval_months, interval_hours, sort_order")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (!role || !can(role as BoatRole, "write")) notFound();

  const hoursByEngine = new Map((hours ?? []).map((row) => [row.engine_id, row]));
  const wizardCategories: WizardCategory[] = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    items: (items ?? [])
      .filter((item) => item.category_id === category.id)
      .map((item) => ({
        id: item.id,
        label: item.label,
        intervalMonths: item.interval_months,
        intervalHours: item.interval_hours,
      })),
  }));

  return (
    <StartupWizard
      boatId={boatId}
      engines={(engines ?? []).map((engine) => ({
        id: engine.id,
        label: engine.label,
        lastHours: hoursByEngine.get(engine.id)?.hours ?? null,
        lastDate: hoursByEngine.get(engine.id)?.read_at ?? null,
      }))}
      categories={wizardCategories.filter((category) => category.items.length > 0)}
    />
  );
}
