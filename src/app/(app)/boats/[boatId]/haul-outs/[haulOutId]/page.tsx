import { notFound } from "next/navigation";

import { HaulOutDetail, type HaulOutLog } from "@/components/haul-outs/HaulOutDetail";
import { daysAshore } from "@/lib/haul-outs";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * Haul-out sheet (E6-1, flow g phase 2): the refit dashboard — works, the interventions
 * attached to the period, and the total the boat actually cost while it was ashore.
 */
export default async function HaulOutPage({
  params,
}: {
  params: Promise<{ boatId: string; haulOutId: string }>;
}) {
  const { boatId, haulOutId } = await params;
  const supabase = await createClient();

  const [{ data: role }, { data: haulOut }, { data: logs }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("haul_outs")
      .select("*")
      .eq("id", haulOutId)
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("maintenance_logs_view")
      .select("id, title, performed_at, cost, category_name, category_color")
      .eq("boat_id", boatId)
      .eq("haul_out_id", haulOutId)
      .order("performed_at", { ascending: true }),
  ]);
  if (!role || !haulOut) notFound();

  let yard = haulOut.yard_name;
  if (haulOut.yard_contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("name")
      .eq("id", haulOut.yard_contact_id)
      .maybeSingle();
    yard = contact?.name ?? haulOut.yard_name;
  }

  const linked: HaulOutLog[] = (logs ?? []).map((log) => ({
    id: log.id ?? "",
    title: log.title ?? "",
    performedAt: log.performed_at ?? "",
    cost: log.cost,
    categoryName: log.category_name,
    categoryColor: log.category_color,
  }));

  return (
    <HaulOutDetail
      boatId={boatId}
      haulOut={{
        id: haulOut.id,
        startedAt: haulOut.started_at,
        endedAt: haulOut.ended_at,
        yard,
        works: haulOut.works,
        cost: haulOut.cost,
        daysAshore: daysAshore(haulOut.started_at, haulOut.ended_at),
      }}
      logs={linked}
      canWrite={can(role as BoatRole, "write")}
    />
  );
}
