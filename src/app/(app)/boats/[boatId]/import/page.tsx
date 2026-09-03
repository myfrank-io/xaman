import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";
import { loadImportCatalog } from "@/lib/import/catalog";
import { descriptorOf, isImportEntity } from "@/lib/import/entities";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath, boatTabPath, stockPath } from "@/lib/queries/boat-routes";
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
  searchParams: Promise<{ entity?: string }>;
}) {
  const [{ boatId }, { entity }] = await Promise.all([params, searchParams]);
  if (!isImportEntity(entity)) notFound();

  const supabase = await createClient();
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (!role || !can(role as BoatRole, "write")) notFound();

  // What is already on the boat, so the screen can say « 3 reconnues » before writing anything.
  const descriptor = descriptorOf(entity);
  let query = supabase.from(descriptor.table).select(descriptor.keyColumns).eq("boat_id", boatId);
  if (descriptor.softDeleted) query = query.is("deleted_at", null);
  const [{ data: existing }, catalog] = await Promise.all([
    query as unknown as Promise<{ data: Record<string, unknown>[] | null }>,
    // What a line may name: the boat's checklist points, or its engines and their counters.
    loadImportCatalog(supabase, boatId, descriptor),
  ]);
  const existingKeys = (existing ?? [])
    .map((row) => descriptor.existingKey(row))
    .filter((key) => key !== "");

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
      />
    </div>
  );
}
