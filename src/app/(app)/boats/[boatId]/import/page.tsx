import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";
import { isImportEntity } from "@/lib/import/entities";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath, boatTabPath, suppliesPath } from "@/lib/queries/boat-routes";
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

  const t = await getTranslations("import");
  const back = {
    contacts: { href: boatPath(boatId, "contacts"), label: t("back.contacts") },
    equipment: { href: boatTabPath(boatId, "equipment"), label: t("back.equipment") },
    parts: { href: suppliesPath(boatId, "stock"), label: t("back.parts") },
  }[entity];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`entities.${entity}.title`)} subtitle={t("subtitle")} />
      <ImportWizard boatId={boatId} entity={entity} backHref={back.href} backLabel={back.label} />
    </div>
  );
}
