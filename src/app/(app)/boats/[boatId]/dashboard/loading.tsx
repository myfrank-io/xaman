import { getTranslations } from "next-intl/server";

import { Bar, DarkBar, SkeletonList, SkeletonScreen } from "../_loading/Skeletons";

/**
 * « À bord » : le bandeau sombre arrive **peint** — identité, phrase d'état, bande moteurs —
 * puis l'acte nommé, la carte « À faire maintenant » et les paliers de la file. C'est l'écran
 * d'arrivée d'un démarrage à froid : ce qu'il ne faut surtout pas remplacer par une roue qui
 * tourne, parce que sa moitié haute est reconnaissable avant d'être lue.
 *
 * Depuis E18-1, il n'y a plus de vignettes ni de grille à peindre : la forme est celle d'une
 * liste, et c'est elle que le squelette annonce.
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DarkBar className="h-8 w-40 rounded-lg" />
          <DarkBar className="h-8 w-40 rounded-lg" />
        </div>
      </header>

      {/* L'acte dominant, nommé, pleine largeur sous `lg` (D35). */}
      <div className="lg:hidden">
        <Bar className="h-12 w-full rounded-lg sm:w-56" />
      </div>

      {/* « À faire maintenant » : l'entrée promue, son intitulé, sa raison et son geste. */}
      <div className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Bar className="h-3 w-32" />
          <Bar className="h-6 w-64 max-w-full" />
          <Bar className="h-3 w-40" />
        </div>
        <Bar className="h-11 w-24 shrink-0 rounded-lg" />
      </div>

      {/* Deux paliers : un titre en petites capitales, puis ses lignes. */}
      <div className="flex flex-col gap-2">
        <Bar className="h-3 w-28" />
        <SkeletonList rows={3} />
      </div>
      <div className="flex flex-col gap-2">
        <Bar className="h-3 w-28" />
        <SkeletonList rows={2} />
      </div>
    </SkeletonScreen>
  );
}
