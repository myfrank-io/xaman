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
import { readBoatRole } from "@/lib/queries/boat-context";
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
  const t = await getTranslations("logs.form");

  // Les trois préremplissages ne dépendent que de l'URL : le moteur, l'équipement et le point
  // de checklist ne se lisent pas l'un l'autre, seule la *priorité* entre leurs réponses est
  // ordonnée — et ça, ça se décide en mémoire. L'écran enchaînait cinq vagues (rôle, puis les
  // sept lectures du formulaire, puis une par paramètre) là où il n'en fallait qu'une.
  const engineId = firstParam(search.engine);
  const equipmentId = firstParam(search.equipment);
  const itemId = firstParam(search.item);
  const [{ data: role }, data, { data: engine }, { data: equipmentItem }, { data: item }] =
    await Promise.all([
      readBoatRole(boatId),
      logFormData(supabase, boatId, t("equipmentRemoved")),
      engineId
        ? supabase
            .from("engines")
            .select("id")
            .eq("id", engineId)
            .eq("boat_id", boatId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Comme avant : un `?category=` explicite gagne, donc la question ne se pose plus.
      equipmentId && !firstParam(search.category)
        ? supabase
            .from("equipment")
            .select("category_id")
            .eq("id", equipmentId)
            .eq("boat_id", boatId)
            .is("deleted_at", null)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      itemId
        ? supabase
            .from("checklist_items")
            .select("id, label, category_id, engine_id, interval_hours")
            .eq("id", itemId)
            .eq("boat_id", boatId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  if (!role) notFound();
  const boatRole = role as BoatRole;
  if (!can(boatRole, "contribute")) notFound();

  const prefill: LogFormPrefill = {
    title: firstParam(search.title),
    categoryId: firstParam(search.category),
    performedAt: firstParam(search.date),
    contactId: firstParam(search.contact),
    equipmentId,
    hours: parseHoursParam(search.hours),
  };

  // L'ordre ci-dessous est celui des trois blocs séquentiels d'avant, à la lettre : le moteur
  // décide en premier, l'équipement ne parle que si personne n'a encore nommé de système.
  //
  // « Noter une intervention » from an engine sheet (D35): the subject is already named, so
  // the form arrives with its category chosen and its hours field open and focused.
  if (engineId && engine) {
    prefill.expandHours = true;
    // The engine category is already resolved for the hours block: reuse it, no extra query.
    prefill.categoryId = prefill.categoryId ?? data.engineCategoryIds[0];
  }

  // Same from an equipment sheet: the piece of equipment carries its own system.
  if (prefill.equipmentId && !prefill.categoryId) {
    prefill.categoryId = equipmentItem?.category_id ?? undefined;
  }

  // « + Ajouter les détails » from the « Fait » dialog: the point is already ticked, its label
  // becomes the title and its category is selected (ux-flows §3a).
  if (itemId && item) {
    prefill.title = prefill.title ?? item.label;
    prefill.categoryId = prefill.categoryId ?? item.category_id;
    prefill.checklistItemIds = [item.id];
    prefill.expandHours = Boolean(item.engine_id);
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
