import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { subMonths, addMonths } from "date-fns";
import { getTranslations } from "next-intl/server";

import { ReportDocument } from "@/components/report/ReportDocument";
import { ReportPrintButton } from "@/components/settings/ReportPrintButton";
import { Button } from "@/components/ui/button";
import { toDateString } from "@/lib/format";
import { reportPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

const DUE_LIMIT = 60;
const LOGS_LIMIT = 100;
const HAUL_OUTS_LIMIT = 5;

/**
 * Printable state report (E9-2b, D-O1): the deliverable to show an insurer, a buyer or a
 * surveyor. The page reads; `ReportDocument` draws.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ costs?: string }>;
}) {
  const [{ boatId }, { costs }] = await Promise.all([params, searchParams]);
  const showCosts = costs !== "0";
  const supabase = await createClient();
  const today = toDateString(new Date());
  const since = toDateString(subMonths(new Date(), 12));
  const until = toDateString(addMonths(new Date(), 12));

  const [
    { data: boat },
    { data: role },
    { data: engines },
    { data: hours },
    { data: progress },
    { data: due },
    { data: logs },
    { data: haulOuts },
    { count: logsCount },
    { count: completionsCount },
  ] = await Promise.all([
    supabase.from("boats").select("*").eq("id", boatId).maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("engines")
      .select("id, label, brand, model, position")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("engine_current_hours").select("engine_id, hours, read_at").eq("boat_id", boatId),
    supabase
      .from("checklist_category_progress")
      .select("*")
      .eq("boat_id", boatId)
      .order("sort_order"),
    supabase
      .from("checklist_item_status")
      .select("id, label, category_id, status, due_at, due_hours, days_remaining, hours_remaining")
      .eq("boat_id", boatId)
      .in("status", ["overdue", "soon", "ok"])
      .or(`due_at.lte.${until},status.in.(overdue,soon)`)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(DUE_LIMIT),
    supabase
      .from("maintenance_logs_view")
      .select("id, performed_at, title, category_name, contact_name, cost")
      .eq("boat_id", boatId)
      .eq("status", "done")
      .gte("performed_at", since)
      .order("performed_at", { ascending: false })
      .limit(LOGS_LIMIT),
    supabase
      .from("haul_outs")
      .select("id, started_at, ended_at, yard_name, works, cost")
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(HAUL_OUTS_LIMIT),
    supabase
      .from("maintenance_logs")
      .select("id", { count: "exact", head: true })
      .eq("boat_id", boatId)
      .is("deleted_at", null),
    supabase
      .from("checklist_completions")
      .select("id", { count: "exact", head: true })
      .eq("boat_id", boatId),
  ]);
  if (!boat || !role) notFound();

  const t = await getTranslations("report");

  return (
    <ReportDocument
      boat={boat}
      today={today}
      showCosts={showCosts}
      engines={engines ?? []}
      hours={hours ?? []}
      progress={progress ?? []}
      due={due ?? []}
      logs={logs ?? []}
      haulOuts={haulOuts ?? []}
      logsCount={logsCount ?? 0}
      completionsCount={completionsCount ?? 0}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href={reportPath(boatId, !showCosts) as Route}>
              {showCosts ? t("hideCosts") : t("showCosts")}
            </Link>
          </Button>
          <ReportPrintButton />
        </>
      }
    />
  );
}
