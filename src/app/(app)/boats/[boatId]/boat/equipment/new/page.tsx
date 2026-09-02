import { notFound } from "next/navigation";

import { EquipmentForm } from "@/components/equipment/EquipmentForm";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function NewEquipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ boatId }, { category }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: role }, { data: categories }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (!role || !can(role as BoatRole, "write")) notFound();
  return (
    <EquipmentForm
      boatId={boatId}
      item={null}
      categories={categories ?? []}
      defaultCategoryId={category}
    />
  );
}
