import { getTranslations } from "next-intl/server";

import { CategoriesManager } from "@/components/categories/CategoriesManager";
import { PageHeader } from "@/components/common/PageHeader";
import { DeleteBoatCard } from "@/components/settings/DeleteBoatCard";
import { SettingsSection } from "@/components/settings/SettingsSection";

import { DEV_BOAT_ID, DevShell } from "../../DevShell";
import { SAMPLE_CATEGORY_ROWS } from "../sample";

export default async function DevSettingsPage() {
  const t = await getTranslations("settings");
  const tcat = await getTranslations("categories");
  return (
    <DevShell>
      <div className="flex flex-col gap-10">
        <PageHeader title={t("title")} subtitle="Xaman" />
        <SettingsSection title={t("sections.categories")} description={tcat("description")}>
          <CategoriesManager boatId={DEV_BOAT_ID} categories={SAMPLE_CATEGORY_ROWS} canWrite />
        </SettingsSection>
        <SettingsSection
          title={t("sections.recalibrate")}
          description={t("recalibrate.description")}
          soon={t("soon")}
        />
        <SettingsSection
          title={t("sections.export")}
          description={t("export.description")}
          soon={t("soon")}
        />
        <SettingsSection title={t("sections.danger")}>
          <DeleteBoatCard boatId={DEV_BOAT_ID} boatName="Xaman" />
        </SettingsSection>
      </div>
    </DevShell>
  );
}
