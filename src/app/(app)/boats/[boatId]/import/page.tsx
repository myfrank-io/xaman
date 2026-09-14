import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";
import { inventoryToTable } from "@/lib/inbox/inventory";
import { loadImportCatalog } from "@/lib/import/catalog";
import { descriptorOf, isImportEntity } from "@/lib/import/entities";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath, boatTabPath, stockPath } from "@/lib/queries/boat-routes";
import { activeCategories } from "@/lib/queries/categories";
import { parseSuggestion } from "@/lib/schemas/inbox";
import { readBoatRole } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

/**
 * One import screen for every list of the boat (E12-2): `?entity=` says which. Owner and
 * editor only — importing writes rows like any other creation.
 */
export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ entity?: string; from?: string }>;
}) {
  const [{ boatId }, { entity, from }] = await Promise.all([params, searchParams]);
  if (!isImportEntity(entity)) notFound();

  const supabase = await createClient();

  // What is already on the boat, so the screen can say « 3 reconnues » before writing anything.
  // Tout ne dépend que de `?entity=` : le rôle n'a rien à apprendre aux deux lectures, il n'a
  // donc pas à passer devant elles.
  const descriptor = descriptorOf(entity);
  let query = supabase.from(descriptor.table).select(descriptor.keyColumns).eq("boat_id", boatId);
  if (descriptor.softDeleted) query = query.is("deleted_at", null);
  const [{ data: role }, { data: existing }, catalog] = await Promise.all([
    readBoatRole(boatId),
    query as unknown as Promise<{ data: Record<string, unknown>[] | null }>,
    // What a line may name: the boat's checklist points, or its engines and their counters.
    loadImportCatalog(supabase, boatId, descriptor),
  ]);
  if (!role || !can(role as BoatRole, "write")) notFound();
  const existingKeys = (existing ?? [])
    .map((row) => descriptor.existingKey(row))
    .filter((key) => key !== "");

  /**
   * `?from=` — a document already read as an inventory (E2-10). Its lines arrive as the table
   * this screen reads anyway, so the builder's specification gets the same preview a spreadsheet
   * does: which lines are new, which are recognised, which are refused and why.
   */
  let initialText: string | undefined;
  if (from && entity === "equipment") {
    const { data: item } = await supabase
      .from("inbox_items")
      .select("suggestion")
      .eq("id", from)
      .eq("boat_id", boatId)
      .maybeSingle();
    const suggestion = parseSuggestion(item?.suggestion);
    if (suggestion && suggestion.inventory.length > 0) {
      initialText = inventoryToTable(
        suggestion.inventory,
        await activeCategories(supabase, boatId),
      );
    }
  }

  const t = await getTranslations("import");
  const back = {
    logs: { href: boatPath(boatId, "logs"), label: t("back.logs") },
    purchases: { href: boatPath(boatId, "supplies"), label: t("back.purchases") },
    contacts: { href: boatPath(boatId, "contacts"), label: t("back.contacts") },
    equipment: { href: boatTabPath(boatId, "equipment"), label: t("back.equipment") },
    parts: { href: stockPath(boatId), label: t("back.parts") },
    completions: { href: boatPath(boatId, "checklist"), label: t("back.completions") },
    readings: { href: boatTabPath(boatId, "engines"), label: t("back.readings") },
  }[entity];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`entities.${entity}.title`)} subtitle={t("subtitle")} />
      <ImportWizard
        boatId={boatId}
        entity={entity}
        backHref={back.href}
        backLabel={back.label}
        existingKeys={existingKeys}
        catalog={catalog}
        initialText={initialText}
      />
    </div>
  );
}
