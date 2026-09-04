import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DocumentImport } from "@/components/attachments/DocumentImport";
import { Button } from "@/components/ui/button";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

/** How far back the picker of existing interventions goes: a season of paperwork, not a decade. */
const RECENT_LOGS = 200;

/**
 * « Importer des documents » (E10-1): the pile of invoices and photos, sorted one by one onto
 * the interventions they belong to — or onto interventions created from them.
 */
export default async function ImportDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ boatId }, { from }] = await Promise.all([params, searchParams]);
  // Straight off « Ouvrir le carnet » with a paper logbook to photograph (D66): the way back is
  // the dashboard of the new boat, not a list of interventions that does not exist yet.
  const fromNew = from === "new";
  const supabase = await createClient();
  const [{ data: role }, { data: logs }, { data: categories }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("maintenance_logs_view")
      .select("id, title, performed_at")
      .eq("boat_id", boatId)
      .order("performed_at", { ascending: false })
      .limit(RECENT_LOGS),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (!role) notFound();

  const [t, ta] = await Promise.all([getTranslations("logs"), getTranslations("attachments")]);

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href={boatPath(boatId, fromNew ? "dashboard" : "logs") as Route}>
          <ChevronLeftIcon />
          {fromNew ? ta("import.dashboard") : t("title")}
        </Link>
      </Button>
      <DocumentImport
        boatId={boatId}
        logs={(logs ?? []).map((log) => ({
          id: log.id ?? "",
          title: log.title ?? "",
          performedAt: log.performed_at ?? "",
        }))}
        categories={categories ?? []}
        canWrite={can(role as BoatRole, "contribute")}
      />
    </div>
  );
}
