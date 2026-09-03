import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";

import { DEV_BOAT_ID, DevShell } from "../DevShell";

/** Visual acceptance of the import screen (E12-2) without a database. */
export default async function DevImportPage() {
  const t = await getTranslations("import");
  return (
    <DevShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t("entities.parts.title")} subtitle={t("subtitle")} />
        <ImportWizard
          boatId={DEV_BOAT_ID}
          entity="parts"
          backHref="/dev/ui"
          backLabel={t("back.parts")}
        />
      </div>
    </DevShell>
  );
}
