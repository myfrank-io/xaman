import { notFound } from "next/navigation";

import { HaulOutForm } from "@/components/haul-outs/HaulOutForm";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

// New haul-out (E6-1, flow g phase 1): four taps at the lift-out, launch date left empty.
export default async function NewHaulOutPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: contacts }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("contacts")
      .select("id, name, specialty, company, phone")
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (!role || !can(role as BoatRole, "write")) notFound();

  return <HaulOutForm boatId={boatId} haulOut={null} contacts={contacts ?? []} />;
}
