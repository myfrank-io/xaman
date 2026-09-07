import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BoatsShell } from "@/components/boats/BoatsShell";
import { NewBoatForm } from "@/components/boats/NewBoatForm";
import { OnboardingSteps } from "@/components/onboarding/OnboardingSteps";
import { devUiEnabled } from "@/lib/dev-ui";

import { SAMPLE_BOAT_MODELS } from "../../boat/sample";

/**
 * Visual acceptance of « Ajouter mon bateau » (D65). The real screen only exists for an account
 * with no boat, which nobody on the team has any more — so without this page it would ship
 * having been looked at on one viewport, by accident.
 *
 * The catalogue (D69) is here only to feed the builder and model suggestions: since D65 the
 * screen asks about the boat, never about a maintenance plan.
 *
 * Shown in its returning-owner shape (D72): « ‹ Retour à l'application » in the header, no
 * sign-out in the footer. That is the variant with something to measure — the other one is this
 * screen minus a link, and it is the one everybody has already seen.
 */
export default async function DevNewBoatPage() {
  if (!devUiEnabled()) notFound();
  const t = await getTranslations("boats.new");

  return (
    <BoatsShell
      title={t("title")}
      subtitle={t("subtitle")}
      back={{ href: "/boats", label: t("back") }}
    >
      <OnboardingSteps step={1} />
      <NewBoatForm models={SAMPLE_BOAT_MODELS} />
      <p className="text-caption text-ink-2">{t("invited")}</p>
    </BoatsShell>
  );
}
