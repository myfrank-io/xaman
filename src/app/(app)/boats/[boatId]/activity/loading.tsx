import { getTranslations } from "next-intl/server";

import { SkeletonList, SkeletonPageHeader, SkeletonScreen } from "../_loading/Skeletons";

/** « Ce qui a bougé » : un titre, puis une liste de faits datés (E18-3). */
export default async function ActivityLoading() {
  const t = await getTranslations("common");
  return (
    <SkeletonScreen label={t("loading")}>
      <SkeletonPageHeader actions={0} />
      <SkeletonList rows={8} lead />
    </SkeletonScreen>
  );
}
