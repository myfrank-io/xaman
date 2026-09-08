import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { HaulOutsList, type HaulOutListItem } from "@/components/haul-outs/HaulOutsList";
import { LogsTabs } from "@/components/logs/LogsTabs";
import { Button } from "@/components/ui/button";
import { daysAshore } from "@/lib/haul-outs";
import { can, type BoatRole } from "@/lib/permissions";
import { loadLogAttention } from "@/lib/queries/attention";
import { newHaulOutPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Sorties de l'eau (E6-1): the third tab of the Journal (D9), reached from its strip and from
 * the dashboard recap. Most recent first; « à terre » is what the list must answer at a glance.
 *
 * The screen wears the section it belongs to — same heading, same strip, Interventions lit in
 * the menu — because it IS that section: a list of haul-outs is one of the three ways of
 * reading the log book, not a place of its own.
 */
export default async function HaulOutsPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();

  const [{ data: role }, { data: haulOuts }, { data: contacts }, { data: logs }, attentionCount] =
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
      // Le bandeau d'onglets est le même objet sur les trois écrans : il porte donc le même
      // point rouge sur « Prévu », d'où qu'on le regarde (D88).
      loadLogAttention(supabase, boatId),
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

  const [t, tl, tc] = await Promise.all([
    getTranslations("haulOuts"),
    getTranslations("logs"),
    getTranslations("create"),
  ]);
  const canWrite = can(role as BoatRole, "write");
  return (
    <div className="flex flex-col gap-6">
      {/* The heading names the section, the strip below says which of its three views is open —
          as on the two other tabs. The object of this one is named at the top right (D35), so
          the frame's control steps aside here exactly as it does on the journal. */}
      <PageHeader
        title={tl("title")}
        subtitle={t("subtitle")}
        actions={
          canWrite ? (
            <Button asChild size="xl">
              <Link href={newHaulOutPath(boatId) as Route}>
                <PlusIcon />
                {tc("newHaulOut")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <LogsTabs boatId={boatId} active="haulOuts" attentionCount={attentionCount} />

      <HaulOutsList boatId={boatId} haulOuts={list} canWrite={canWrite} />
    </div>
  );
}
