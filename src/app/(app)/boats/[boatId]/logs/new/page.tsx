import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LogForm } from "@/components/logs/LogForm";
import {
  firstParam,
  parseHoursParam,
  type LogFormPrefill,
} from "@/components/logs/log-form-values";
import { can, type BoatRole } from "@/lib/permissions";
import { logFormData } from "@/lib/queries/log-form-data";
import { createClient } from "@/lib/supabase/server";

type Search = Record<string, string | string[] | undefined>;

/**
 * « + Intervention » (E3-3). Prefilled from the query string when it comes from the checklist
 * dialog (`?item=`, `?date=`, `?hours=<engine>:<h>`) or from « Refaire » on a detail page.
 */
export default async function NewLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<Search>;
}) {
  const { boatId } = await params;
  const search = await searchParams;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (!role) notFound();
  const boatRole = role as BoatRole;
  if (!can(boatRole, "contribute")) notFound();

  const t = await getTranslations("logs.form");
  const data = await logFormData(supabase, boatId, t("equipmentRemoved"));

  const prefill: LogFormPrefill = {
    title: firstParam(search.title),
    categoryId: firstParam(search.category),
    performedAt: firstParam(search.date),
    contactId: firstParam(search.contact),
    equipmentId: firstParam(search.equipment),
    hours: parseHoursParam(search.hours),
  };

  // « Noter une intervention » from an engine sheet (D35): the subject is already named, so
  // the form arrives with its category chosen and its hours field open and focused.
  const engineId = firstParam(search.engine);
  if (engineId) {
    const { data: engine } = await supabase
      .from("engines")
      .select("id")
      .eq("id", engineId)
      .eq("boat_id", boatId)
      .maybeSingle();
    if (engine) {
      prefill.expandHours = true;
      // The engine category is already resolved for the hours block: reuse it, no extra query.
      prefill.categoryId = prefill.categoryId ?? data.engineCategoryIds[0];
    }
  }

  // Same from an equipment sheet: the piece of equipment carries its own system.
  if (prefill.equipmentId && !prefill.categoryId) {
    const { data: item } = await supabase
      .from("equipment")
      .select("category_id")
      .eq("id", prefill.equipmentId)
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .maybeSingle();
    prefill.categoryId = item?.category_id ?? undefined;
  }

  // « + Ajouter les détails » from the « Fait » dialog: the point is already ticked, its label
  // becomes the title and its category is selected (ux-flows §3a).
  const itemId = firstParam(search.item);
  if (itemId) {
    const { data: item } = await supabase
      .from("checklist_items")
      .select("id, label, category_id, engine_id, interval_hours")
      .eq("id", itemId)
      .eq("boat_id", boatId)
      .maybeSingle();
    if (item) {
      prefill.title = prefill.title ?? item.label;
      prefill.categoryId = prefill.categoryId ?? item.category_id;
      prefill.checklistItemIds = [item.id];
      prefill.expandHours = Boolean(item.engine_id);
    }
  }
  if (prefill.hours && prefill.hours.length > 0) prefill.expandHours = true;

  return (
    <LogForm
      boatId={boatId}
      log={null}
      prefill={prefill}
      categories={data.categories}
      engines={data.engines}
      engineCategoryIds={data.engineCategoryIds}
      contacts={data.contacts}
      equipment={data.equipment}
      haulOuts={data.haulOuts}
      canCreateContact={can(boatRole, "write")}
    />
  );
}
