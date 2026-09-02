import { notFound } from "next/navigation";

import { EngineForm } from "@/components/engines/EngineForm";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function EditEnginePage({
  params,
}: {
  params: Promise<{ boatId: string; engineId: string }>;
}) {
  const { boatId, engineId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: engine }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase.from("engines").select("*").eq("id", engineId).eq("boat_id", boatId).maybeSingle(),
  ]);
  if (!role || !can(role as BoatRole, "write") || !engine) notFound();
  return (
    <EngineForm
      boatId={boatId}
      engine={{
        id: engine.id,
        label: engine.label,
        position: engine.position,
        brand: engine.brand,
        model: engine.model,
        serial: engine.serial,
        installedAt: engine.installed_at,
        notes: engine.notes,
        updatedAt: engine.updated_at,
      }}
    />
  );
}
