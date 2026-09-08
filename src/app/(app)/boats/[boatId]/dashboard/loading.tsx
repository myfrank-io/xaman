import { getTranslations } from "next-intl/server";

import {
  Bar,
  DarkBar,
  SkeletonCategoryGrid,
  SkeletonList,
  SkeletonScreen,
  SkeletonSection,
  SkeletonStatCard,
} from "../_loading/Skeletons";

/**
 * Tableau de bord : le bandeau sombre arrive **peint**, avec ses quatre vignettes et sa bande
 * moteurs, puis la file, les systèmes, les dernières interventions et le récapitulatif. C'est
 * l'écran d'arrivée d'un démarrage à froid : ce qu'il ne faut surtout pas remplacer par une
 * roue qui tourne, parce que sa moitié haute est reconnaissable avant d'être lue.
 */
export default async function DashboardLoading() {
  const t = await getTranslations("common");
  return (
    <SkeletonScreen label={t("loading")}>
      <header className="-mx-4 -mt-3 bg-header-gradient px-4 pt-5 pb-4 brass-rule sm:-mx-6 sm:-mt-4 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <DarkBar className="h-7 w-40" />
            <DarkBar className="mt-1.5 h-3 w-56 max-w-full" />
          </div>
          <DarkBar className="h-3 w-48 max-w-full" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SkeletonStatCard dark />
          <SkeletonStatCard dark />
          <SkeletonStatCard dark />
          <SkeletonStatCard dark />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DarkBar className="h-8 w-40 rounded-lg" />
          <DarkBar className="h-8 w-40 rounded-lg" />
        </div>
      </header>

      {/* L'acte dominant, nommé, pleine largeur sous `lg` (D35). */}
      <div className="lg:hidden">
        <Bar className="h-12 w-full rounded-lg sm:w-56" />
      </div>

      <SkeletonSection bare action>
        <SkeletonList rows={4} lead />
      </SkeletonSection>

      <SkeletonSection bare action>
        <SkeletonCategoryGrid />
      </SkeletonSection>

      <SkeletonSection bare action>
        <SkeletonList rows={3} lead />
      </SkeletonSection>

      <SkeletonSection bare>
        <SkeletonList rows={3} />
      </SkeletonSection>
    </SkeletonScreen>
  );
}
