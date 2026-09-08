import { getTranslations } from "next-intl/server";

import {
  Bar,
  SkeletonCategoryGrid,
  SkeletonPageHeader,
  SkeletonScreen,
  SkeletonSection,
  SkeletonTabs,
} from "../_loading/Skeletons";

/** Checklist : titre + actions, les deux onglets, « À racheter », puis la grille des systèmes. */
export default async function ChecklistLoading() {
  const t = await getTranslations("common");
  return (
    <SkeletonScreen label={t("loading")}>
      <SkeletonPageHeader actions={2} />
      <SkeletonTabs />
      <SkeletonSection action bare>
        <Bar className="h-16 w-full rounded-xl" />
      </SkeletonSection>
      <SkeletonCategoryGrid />
    </SkeletonScreen>
  );
}
