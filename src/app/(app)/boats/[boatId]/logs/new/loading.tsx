import { getTranslations } from "next-intl/server";

import { SkeletonForm, SkeletonScreen } from "../../_loading/Skeletons";

/** « + Intervention » : le formulaire le plus lourd de l'app, donc celui qui doit s'ouvrir vide. */
export default async function NewLogLoading() {
  const t = await getTranslations("common");
  return (
    <SkeletonScreen label={t("loading")}>
      <SkeletonForm fields={6} />
    </SkeletonScreen>
  );
}
