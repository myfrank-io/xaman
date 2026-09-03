import { notFound } from "next/navigation";

import type { ChecklistState } from "@/components/common/ChecklistStateBadge";
import type { LogStatus } from "@/components/common/StatusBadge";
import {
  EngineSheet,
  type EngineItemRow,
  type EngineLogRow,
  type EngineReadingRow,
} from "@/components/engines/EngineSheet";
import { can, type BoatRole } from "@/lib/permissions";
import { AuditFooter } from "@/components/common/AuditFooter";
import { auditNames } from "@/lib/queries/audit-names";
import { createClient } from "@/lib/supabase/server";

export default async function EnginePage({
  params,
}: {
  params: Promise<{ boatId: string; engineId: string }>;
}) {
  const { boatId, engineId } = await params;
  const supabase = await createClient();
  const [
    { data: engine },
    { data: role },
    { data: boat },
    { data: current },
    { data: items },
    { data: readings },
    { count: linkedCount },
  ] = await Promise.all([
    supabase.from("engines").select("*").eq("id", engineId).eq("boat_id", boatId).maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase.from("boats").select("checklist_template_id").eq("id", boatId).maybeSingle(),
    supabase
      .from("engine_current_hours")
      .select("hours, read_at, reading_id")
      .eq("boat_id", boatId)
      .eq("engine_id", engineId)
      .maybeSingle(),
    supabase
      .from("checklist_item_status")
      .select(
        "id, label, category_id, interval_months, interval_hours, status, days_remaining, hours_remaining, current_hours, last_completed_at, last_engine_hours, sort_order",
      )
      .eq("boat_id", boatId)
      .eq("engine_id", engineId)
      .order("sort_order"),
    supabase
      .from("engine_hour_readings")
      .select(
        "id, hours, read_at, source, note, maintenance_log_id, updated_at, profiles!engine_hour_readings_created_by_fkey(full_name, email)",
      )
      .eq("engine_id", engineId)
      .order("read_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("engine_id", engineId)
      .eq("is_active", true),
  ]);
  if (!engine || !role) notFound();
  const boatRole = role as BoatRole;

  const logIds = (readings ?? [])
    .map((reading) => reading.maintenance_log_id)
    .filter((id): id is string => Boolean(id));
  const { data: logs } = logIds.length
    ? await supabase
        .from("maintenance_logs_view")
        .select("id, title, performed_at, status, cost, contact_name")
        .in("id", logIds)
        .order("performed_at", { ascending: false })
    : { data: [] };

  const currentReading = (readings ?? []).find((reading) => reading.id === current?.reading_id);
  const byName = (reading: (typeof readings extends (infer R)[] | null ? R : never) | undefined) =>
    reading?.profiles?.full_name ?? reading?.profiles?.email ?? null;

  const STATE_ORDER: Record<ChecklistState, number> = { overdue: 0, soon: 1, never: 2, ok: 3 };
  const itemRows: EngineItemRow[] = (items ?? [])
    .map((item) => ({
      id: item.id ?? "",
      label: item.label ?? "",
      categoryId: item.category_id ?? "",
      intervalMonths: item.interval_months,
      intervalHours: item.interval_hours,
      status: (item.status ?? "never") as ChecklistState,
      daysRemaining: item.days_remaining,
      hoursRemaining: item.hours_remaining,
      hasCounter: item.current_hours !== null,
      lastCompletedAt: item.last_completed_at,
      lastEngineHours: item.last_engine_hours,
    }))
    .sort((a, b) => STATE_ORDER[a.status] - STATE_ORDER[b.status]);

  const readingRows: EngineReadingRow[] = (readings ?? []).map((reading) => ({
    id: reading.id,
    hours: reading.hours,
    readAt: reading.read_at,
    source: reading.source,
    note: reading.note,
    byName: byName(reading),
    updatedAt: reading.updated_at,
  }));

  const logRows: EngineLogRow[] = (logs ?? []).map((log) => ({
    id: log.id ?? "",
    title: log.title ?? "",
    performedAt: log.performed_at ?? "",
    status: (log.status ?? "done") as LogStatus,
    cost: log.cost,
    contactName: log.contact_name,
  }));

  const names = await auditNames(supabase, [engine.created_by, engine.updated_by]);

  return (
    <div className="flex flex-col gap-6">
      <EngineSheet
        boatId={boatId}
        engine={{
          id: engine.id,
          label: engine.label,
          position: engine.position,
          brand: engine.brand,
          model: engine.model,
          serial: engine.serial,
          installedAt: engine.installed_at,
          notes: engine.notes,
          isActive: engine.is_active,
          counterResetAt: engine.counter_reset_at,
        }}
        currentHours={current?.hours ?? null}
        currentReadAt={current?.read_at ?? null}
        currentByName={byName(currentReading)}
        items={itemRows}
        readings={readingRows}
        logs={logRows}
        linkedCount={linkedCount ?? 0}
        hasTemplate={Boolean(boat?.checklist_template_id)}
        canWrite={can(boatRole, "write")}
        canContribute={can(boatRole, "contribute")}
      />
      <AuditFooter
        createdByName={names.get(engine.created_by ?? "")}
        createdAt={engine.created_at}
        updatedByName={names.get(engine.updated_by ?? "")}
        updatedAt={engine.updated_at}
      />
    </div>
  );
}
