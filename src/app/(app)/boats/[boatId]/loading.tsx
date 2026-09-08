import { getTranslations } from "next-intl/server";

import { SkeletonList, SkeletonPageHeader, SkeletonScreen } from "./_loading/Skeletons";

/**
 * Le squelette par défaut de tout ce qui est sous un bateau et n'a pas le sien : un titre,
 * un ou deux boutons, une liste encadrée. C'est la forme qu'ont les écrans secondaires
 * (contacts, sorties de l'eau, corbeille, documents…) — jamais un écran vide en attendant.
 */
export default async function BoatLoading() {
  const t = await getTranslations("common");
  return (
    <SkeletonScreen label={t("loading")}>
      <SkeletonPageHeader />
      <SkeletonList rows={6} lead />
    </SkeletonScreen>
  );
}
