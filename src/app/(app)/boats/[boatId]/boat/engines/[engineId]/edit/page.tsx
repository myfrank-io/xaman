import { notFound } from "next/navigation";

import { EngineForm } from "@/components/engines/EngineForm";
import { can, type BoatRole } from "@/lib/permissions";
import { readBoatRole } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

export default async function EditEnginePage({
  params,
}: {
  params: Promise<{ boatId: string; engineId: string }>;
}) {
  const { boatId, engineId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: engine }] = await Promise.all([
    readBoatRole(boatId),
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
        propulsion: engine.propulsion,
        brand: engine.brand,
        model: engine.model,
        serial: engine.serial,
        installedAt: engine.installed_at,
        tracksHours: engine.tracks_hours,
        notes: engine.notes,
        updatedAt: engine.updated_at,
      }}
    />
  );
}
