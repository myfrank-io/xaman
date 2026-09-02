import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { firstParam } from "@/components/logs/log-form-values";
import { ReviewTable } from "@/components/review/ReviewTable";
import type { ReviewHourContext, ReviewLog, ReviewPurchase } from "@/components/review/review-rows";
import { Button } from "@/components/ui/button";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

type Search = Record<string, string | string[] | undefined>;

/** `pending_engine_hours` is `{ "<engine_id>": <hours> }`. */
function parsePending(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [engineId, raw] of Object.entries(value as Record<string, unknown>)) {
    const hours = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(hours)) out[engineId] = hours;
  }
  return out;
}

/**
 * « Reprise du carnet » (E3-7, D24). Reserved to owner / editor, like `mark_log_reviewed`.
 * The lines are listed in chronological order: each validated line lights the next one.
 */
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<Search>;
}) {
  const { boatId } = await params;
  const search = await searchParams;
  const onlyLog = firstParam(search.log);

  const supabase = await createClient();
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (!role) notFound();
  if (!can(role as BoatRole, "write")) notFound();

  const [{ data: rows }, { data: engines }, { data: readings }, { data: purchases }] =
    await Promise.all([
      supabase
        .from("maintenance_logs_view")
        .select(
          "id, title, performed_at, category_name, category_color, contact_name, notes, pending_engine_hours",
        )
        .eq("boat_id", boatId)
        .eq("needs_review", true)
        .order("performed_at", { ascending: true }),
      supabase
        .from("engines")
        .select("id, label, sort_order")
        .eq("boat_id", boatId)
        .order("sort_order"),
      supabase
        .from("engine_hour_readings")
        .select("engine_id, hours, read_at")
        .eq("boat_id", boatId)
        .order("read_at", { ascending: true }),
      supabase
        .from("purchases")
        .select("id, purchased_at, designation, amount")
        .eq("boat_id", boatId)
        .eq("needs_review", true)
        .is("deleted_at", null)
        .order("purchased_at", { ascending: true }),
    ]);

  const engineLabel = new Map((engines ?? []).map((engine) => [engine.id, engine.label]));
  const engineOrder = new Map((engines ?? []).map((engine, index) => [engine.id, index]));
  const pendingByLog = (rows ?? []).map((row) => ({
    row,
    pending: parsePending(row.pending_engine_hours),
  }));

  const logs: ReviewLog[] = pendingByLog.map(({ row, pending }, index) => {
    const hours: ReviewHourContext[] = Object.entries(pending)
      .map(([engineId, bookHours]) => {
        // last validated reading of this engine on or before the line's date
        const previous = (readings ?? [])
          .filter(
            (reading) =>
              reading.engine_id === engineId && reading.read_at <= (row.performed_at ?? ""),
          )
          .at(-1);
        // next value still waiting further down the chronological list
        const following = pendingByLog
          .slice(index + 1)
          .find((entry) => entry.pending[engineId] !== undefined);
        return {
          engineId,
          engineLabel: engineLabel.get(engineId) ?? engineId,
          bookHours,
          previous: previous ? { hours: previous.hours, date: previous.read_at } : null,
          next: following
            ? {
                hours: following.pending[engineId]!,
                date: following.row.performed_at ?? "",
              }
            : null,
        };
      })
      .sort((a, b) => (engineOrder.get(a.engineId) ?? 0) - (engineOrder.get(b.engineId) ?? 0));

    return {
      id: row.id ?? "",
      title: row.title ?? "",
      performedAt: row.performed_at ?? "",
      categoryName: row.category_name,
      categoryColor: row.category_color,
      contactName: row.contact_name,
      notes: row.notes,
      hours,
    };
  });

  const t = await getTranslations("review");
  const tl = await getTranslations("logs");
  const visibleLogs = onlyLog ? logs.filter((log) => log.id === onlyLog) : logs;
  const visiblePurchases: ReviewPurchase[] = onlyLog
    ? []
    : (purchases ?? []).map((row) => ({
        id: row.id,
        purchasedAt: row.purchased_at,
        designation: row.designation,
        amount: row.amount,
      }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={boatPath(boatId, "logs") as Route}>
            <ChevronLeftIcon />
            {tl("title")}
          </Link>
        </Button>
        <PageHeader className="mt-2" title={t("title")} subtitle={t("description")} />
      </div>
      <ReviewTable
        boatId={boatId}
        logs={visibleLogs}
        purchases={visiblePurchases}
        singleLog={Boolean(onlyLog)}
      />
    </div>
  );
}
