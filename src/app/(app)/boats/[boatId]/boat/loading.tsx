import { getTranslations } from "next-intl/server";

import { Bar, SkeletonList, SkeletonScreen, SkeletonTabs } from "../_loading/Skeletons";

/** Bateau : la carte d'identité, les deux onglets, puis la liste (équipements par défaut). */
export default async function BoatTabLoading() {
  const t = await getTranslations("common");
  return (
    <SkeletonScreen label={t("loading")}>
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Bar className="h-7 w-48 sm:h-8" />
            <Bar className="mt-2 h-4 w-64 max-w-full" />
          </div>
          <Bar className="h-11 w-24 rounded-lg" />
        </div>
        <Bar className="h-14 w-full rounded-xl" />
      </div>
      <SkeletonTabs />
      <SkeletonList rows={6} />
    </SkeletonScreen>
  );
}
