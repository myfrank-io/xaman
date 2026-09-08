import { getTranslations } from "next-intl/server";

import {
  Bar,
  SkeletonList,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSection,
  SkeletonStatCard,
} from "../_loading/Skeletons";

/** Dépenses : titre, filtres repliés, les trois vignettes, la répartition, puis les lignes. */
export default async function SuppliesLoading() {
  const t = await getTranslations("common");
  return (
    <SkeletonScreen label={t("loading")}>
      <SkeletonPageHeader />
      <Bar className="h-16 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <SkeletonSection bare action>
        <SkeletonList rows={4} />
      </SkeletonSection>
      <SkeletonSection bare>
        <SkeletonList rows={6} lead />
      </SkeletonSection>
    </SkeletonScreen>
  );
}
