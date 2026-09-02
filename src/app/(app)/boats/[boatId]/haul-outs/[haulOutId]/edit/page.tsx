import { notFound } from "next/navigation";

import { HaulOutForm } from "@/components/haul-outs/HaulOutForm";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

// Edit a haul-out (E6-1): the same page form, `ended_at` filled at the launch.
export default async function EditHaulOutPage({
  params,
}: {
  params: Promise<{ boatId: string; haulOutId: string }>;
}) {
  const { boatId, haulOutId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: haulOut }, { data: contacts }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("haul_outs")
      .select("*")
      .eq("id", haulOutId)
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id, name, specialty, company, phone")
      .eq("boat_id", boatId)
      .order("name"),
  ]);
  if (!role || !can(role as BoatRole, "write") || !haulOut) notFound();

  return (
    <HaulOutForm
      boatId={boatId}
      haulOut={{
        id: haulOut.id,
        startedAt: haulOut.started_at,
        endedAt: haulOut.ended_at,
        yardContactId: haulOut.yard_contact_id,
        yardName: haulOut.yard_name,
        works: haulOut.works,
        cost: haulOut.cost,
        updatedAt: haulOut.updated_at,
      }}
      contacts={contacts ?? []}
    />
  );
}
