import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { HaulOutsList, type HaulOutListItem } from "@/components/haul-outs/HaulOutsList";
import { daysAshore } from "@/lib/haul-outs";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * Sorties de l'eau (E6-1), reached from the « Plus » sheet and from the dashboard recap.
 * Most recent first; « à terre » is what the list must answer at a glance.
 */
export default async function HaulOutsPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();

  const [{ data: role }, { data: haulOuts }, { data: contacts }, { data: logs }] =
    await Promise.all([
      supabase.rpc("boat_role", { p_boat_id: boatId }),
      supabase
        .from("haul_outs")
        .select("id, started_at, ended_at, yard_contact_id, yard_name, cost")
        .eq("boat_id", boatId)
        .is("deleted_at", null)
        .order("started_at", { ascending: false }),
      // Not filtered on deleted_at on purpose: this map only turns a yard_contact_id into a
      // name, and a haul-out must keep the name of a yard someone trashed afterwards.
      supabase.from("contacts").select("id, name").eq("boat_id", boatId),
      supabase
        .from("maintenance_logs")
        .select("haul_out_id")
        .eq("boat_id", boatId)
        .is("deleted_at", null)
        .not("haul_out_id", "is", null),
    ]);
  if (!role) notFound();

  const contactNames = new Map((contacts ?? []).map((contact) => [contact.id, contact.name]));
  const logsByHaulOut = new Map<string, number>();
  for (const log of logs ?? []) {
    if (log.haul_out_id) {
      logsByHaulOut.set(log.haul_out_id, (logsByHaulOut.get(log.haul_out_id) ?? 0) + 1);
    }
  }

  const list: HaulOutListItem[] = (haulOuts ?? []).map((haulOut) => ({
    id: haulOut.id,
    startedAt: haulOut.started_at,
    endedAt: haulOut.ended_at,
    yard: haulOut.yard_contact_id
      ? (contactNames.get(haulOut.yard_contact_id) ?? haulOut.yard_name)
      : haulOut.yard_name,
    cost: haulOut.cost,
    logsCount: logsByHaulOut.get(haulOut.id) ?? 0,
    daysAshore: daysAshore(haulOut.started_at, haulOut.ended_at),
  }));

  const t = await getTranslations("haulOuts");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("count", { count: list.length })} />
      <HaulOutsList boatId={boatId} haulOuts={list} canWrite={can(role as BoatRole, "write")} />
    </div>
  );
}
