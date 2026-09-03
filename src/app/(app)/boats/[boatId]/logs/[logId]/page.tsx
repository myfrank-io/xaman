import { notFound } from "next/navigation";

import { LogActions } from "@/components/logs/LogActions";
import { LogDetail, type LogDetailCompletion } from "@/components/logs/LogDetail";
import type { LogStatus } from "@/components/common/StatusBadge";
import { parseEngineHours } from "@/components/logs/rows";
import { formatDate } from "@/lib/format";
import { can, type BoatRole } from "@/lib/permissions";
import { listAttachments } from "@/lib/queries/attachments";
import { createClient } from "@/lib/supabase/server";

/**
 * Detail of an intervention (E3-4). Reads everything the screen shows; `LogDetail` renders it.
 * A `pro` sees « Modifier » on their own rows and nothing else (D23).
 */
export default async function LogPage({
  params,
}: {
  params: Promise<{ boatId: string; logId: string }>;
}) {
  const { boatId, logId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: log }, { data: auth }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("maintenance_logs_view")
      .select("*")
      .eq("id", logId)
      .eq("boat_id", boatId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!role || !log?.id) notFound();
  const boatRole = role as BoatRole;

  const [
    { data: completions },
    { data: purchases },
    { data: haulOut },
    { data: contact },
    { data: updatedBy },
    { data: categories },
    attachments,
  ] = await Promise.all([
    supabase
      .from("checklist_completions")
      .select("id, engine_hours, checklist_items(id, label, category_id)")
      .eq("maintenance_log_id", logId),
    supabase
      .from("purchases")
      .select("id, designation, amount")
      .eq("maintenance_log_id", logId)
      .is("deleted_at", null),
    log.haul_out_id
      ? supabase
          .from("haul_outs")
          .select("id, started_at, yard_name")
          .eq("id", log.haul_out_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    log.contact_id
      ? supabase.from("contacts").select("id, name, phone").eq("id", log.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    log.updated_by
      ? supabase.from("profiles").select("full_name, email").eq("id", log.updated_by).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("boat_categories").select("id, name, color, icon").eq("boat_id", boatId),
    // Documents of the intervention with their signed URLs (E10-1); a Storage hiccup must not
    // take the whole sheet down, so it degrades to an empty gallery.
    listAttachments(supabase, boatId, { type: "maintenance_log", id: logId }).catch(() => []),
  ]);

  const canWrite = can(boatRole, "write");
  const canEdit = canWrite || (boatRole === "pro" && log.created_by === auth.user?.id);
  const engineHours = parseEngineHours(log.engine_hours);
  const linked: LogDetailCompletion[] = (completions ?? []).map((completion) => {
    const item = completion.checklist_items;
    const category = categories?.find((row) => row.id === item?.category_id);
    return {
      id: completion.id,
      label: item?.label ?? "",
      categoryId: item?.category_id ?? null,
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      engineHours: completion.engine_hours,
    };
  });

  return (
    <LogDetail
      boatId={boatId}
      canWrite={canWrite}
      log={{
        id: log.id,
        title: log.title ?? "",
        performedAt: log.performed_at ?? "",
        status: (log.status ?? "done") as LogStatus,
        categoryId: log.category_id,
        categoryName: log.category_name,
        categoryColor: log.category_color,
        categoryIcon: categories?.find((row) => row.id === log.category_id)?.icon ?? null,
        categoryArchived: log.category_is_active === false,
        cost: log.cost,
        notes: log.notes,
        equipmentName: log.equipment_name,
        needsReview: log.needs_review ?? false,
        createdByName: log.created_by_name,
        createdAt: log.created_at ?? "",
        updatedByName: updatedBy?.full_name ?? updatedBy?.email ?? null,
        updatedAt: log.updated_at ?? "",
      }}
      contact={contact ? { name: contact.name, phone: contact.phone } : null}
      haulOut={
        haulOut
          ? {
              id: haulOut.id,
              label: [formatDate(haulOut.started_at), haulOut.yard_name]
                .filter(Boolean)
                .join(" · "),
            }
          : null
      }
      engineHours={engineHours}
      completions={linked}
      purchases={purchases ?? []}
      attachments={attachments}
      actions={
        canEdit ? (
          <LogActions
            boatId={boatId}
            canWrite={canWrite}
            log={{
              id: log.id,
              title: log.title ?? "",
              categoryId: log.category_id,
              contactId: log.contact_id,
              equipmentId: log.equipment_id,
              engineHours,
            }}
          />
        ) : undefined
      }
    />
  );
}
