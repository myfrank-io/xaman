"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { SectionCard } from "@/components/common/SectionCard";
import type { BoatModelData } from "@/components/boat-3d/BoatModel3D";

type Props = { boatId: string; boatName: string; data: BoatModelData };

/**
 * La maquette, chargée après la première peinture (perf).
 *
 * `BoatModel3D` et tout ce qu'il traîne — le moteur de rendu `ModelCanvas`, la construction du
 * maillage, le résumé des zones — est le plus gros morceau de JavaScript du tableau de bord, et il
 * vit tout en bas de la page (acte 6, D133), sous la ligne de flottaison. Le mettre dans un
 * `dynamic(ssr:false)` le sort du bundle de première charge : le tableau de bord s'affiche sans
 * l'attendre, et la maquette arrive ensuite, à l'emplacement que le squelette lui a déjà réservé.
 *
 * `ssr: false` impose un composant client ; c'est toute la raison d'être de ce fichier, le
 * tableau de bord étant un Server Component.
 */
const BoatModel3D = dynamic(
  () => import("@/components/boat-3d/BoatModel3D").then((m) => m.BoatModel3D),
  {
    ssr: false,
    loading: () => <BoatModelSkeleton />,
  },
);

/**
 * Le même cadre que la maquette, vide : la carte, le titre, et un rectangle à l'exact ratio du
 * canvas (`aspect-[4/3]`, portrait `lg:aspect-[3/4]`). La place est prise avant que le code
 * n'arrive, donc rien ne saute quand il arrive.
 */
function BoatModelSkeleton() {
  const t = useTranslations("boat3d");
  return (
    <SectionCard title={t("title")} bare>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-surface-sunken lg:aspect-[3/4]" />
        <div className="hidden h-[26rem] animate-pulse rounded-xl bg-surface-sunken lg:block lg:h-[31rem]" />
      </div>
    </SectionCard>
  );
}

export function BoatModel3DLazy(props: Props) {
  return <BoatModel3D {...props} />;
}
