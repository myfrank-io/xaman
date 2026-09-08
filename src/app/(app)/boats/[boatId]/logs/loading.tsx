import { getTranslations } from "next-intl/server";

import {
  Bar,
  SkeletonList,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonTabs,
} from "../_loading/Skeletons";

/** Journal : titre + actions, les onglets, la barre de filtres repliée, vingt lignes. */
export default async function LogsLoading() {
  const t = await getTranslations("common");
  return (
    <SkeletonScreen label={t("loading")}>
      <SkeletonPageHeader actions={2} />
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <SkeletonTabs tabs={3} />
      </div>
      <Bar className="h-14 w-full rounded-xl" />
      <SkeletonList rows={8} lead />
    </SkeletonScreen>
  );
}
