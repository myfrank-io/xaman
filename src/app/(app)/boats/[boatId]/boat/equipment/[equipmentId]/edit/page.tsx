import { notFound } from "next/navigation";

import { EquipmentForm } from "@/components/equipment/EquipmentForm";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function EditEquipmentPage({
  params,
}: {
  params: Promise<{ boatId: string; equipmentId: string }>;
}) {
  const { boatId, equipmentId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: item }, { data: categories }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("equipment")
      .select("*")
      .eq("id", equipmentId)
      .eq("boat_id", boatId)
      .maybeSingle(),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (!role || !can(role as BoatRole, "write") || !item) notFound();
  const specs =
    item.specs && typeof item.specs === "object" && !Array.isArray(item.specs)
      ? Object.entries(item.specs as Record<string, unknown>).map(([key, value]) => ({
          key,
          value: value === null || value === undefined ? "" : String(value),
        }))
      : [];
  return (
    <EquipmentForm
      boatId={boatId}
      item={{
        id: item.id,
        name: item.name,
        categoryId: item.category_id,
        brand: item.brand,
        model: item.model,
        serial: item.serial,
        quantity: item.quantity,
        installedAt: item.installed_at,
        specs,
        notes: item.notes,
        updatedAt: item.updated_at,
      }}
      categories={categories ?? []}
    />
  );
}
