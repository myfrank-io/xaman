import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LogForm } from "@/components/logs/LogForm";
import type { LogFormValues } from "@/components/logs/log-form-values";
import { can, type BoatRole } from "@/lib/permissions";
import { listAttachments } from "@/lib/queries/attachments";
import { logFormData } from "@/lib/queries/log-form-data";
import { readBoatRole } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";
import type { LogStatusValue } from "@/lib/schemas/logs";

// Editing an intervention (E3-3). A `pro` may edit their own rows: RLS decides, the page only
// hides what the role can never do.
export default async function EditLogPage({
  params,
}: {
  params: Promise<{ boatId: string; logId: string }>;
}) {
  const { boatId, logId } = await params;
  const supabase = await createClient();
  const t = await getTranslations("logs.form");
  // Une seule vague : la session et les listes du formulaire ne dépendent pas de l'intervention.
  // Elles arrivaient l'une après l'autre *après* elle — trois allers-retours en file indienne
  // devant un écran qui ne s'ouvre que pour corriger une ligne.
  const [
    { data: role },
    { data: log },
    { data: readings },
    { data: completions },
    attachments,
    { data: auth },
    data,
  ] = await Promise.all([
    readBoatRole(boatId),
    supabase
      .from("maintenance_logs")
      .select(
        "id, title, category_id, status, performed_at, cost, contact_id, equipment_id, haul_out_id, notes, created_by, updated_at",
      )
      .eq("id", logId)
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("engine_hour_readings")
      .select("engine_id, hours")
      .eq("maintenance_log_id", logId),
    supabase
      .from("checklist_completions")
      .select("checklist_item_id")
      .eq("maintenance_log_id", logId),
    // Documents already on the intervention (E10-1); a Storage hiccup leaves the form usable.
    listAttachments(supabase, boatId, { type: "maintenance_log", id: logId }).catch(() => []),
    supabase.auth.getUser(),
    logFormData(supabase, boatId, t("equipmentRemoved")),
  ]);
  if (!role || !log) notFound();
  const boatRole = role as BoatRole;
  const mine = log.created_by === auth.user?.id;
  if (!can(boatRole, "write") && !(boatRole === "pro" && mine)) notFound();

  const values: LogFormValues = {
    id: log.id,
    title: log.title,
    categoryId: log.category_id,
    status: log.status as LogStatusValue,
    performedAt: log.performed_at,
    cost: log.cost,
    contactId: log.contact_id,
    equipmentId: log.equipment_id,
    haulOutId: log.haul_out_id,
    notes: log.notes,
    engineHours: (readings ?? []).map((row) => ({ engineId: row.engine_id, hours: row.hours })),
    checklistItemIds: (completions ?? []).map((row) => row.checklist_item_id),
    updatedAt: log.updated_at,
  };

  return (
    <LogForm
      boatId={boatId}
      log={values}
      categories={data.categories}
      engines={data.engines}
      engineCategoryIds={data.engineCategoryIds}
      contacts={data.contacts}
      equipment={data.equipment}
      haulOuts={data.haulOuts}
      attachments={attachments}
      canCreateContact={can(boatRole, "write")}
    />
  );
}
