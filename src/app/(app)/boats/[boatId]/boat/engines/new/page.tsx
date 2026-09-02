import { notFound } from "next/navigation";

import { EngineForm } from "@/components/engines/EngineForm";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function NewEnginePage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (!role || !can(role as BoatRole, "write")) notFound();
  return <EngineForm boatId={boatId} engine={null} />;
}
