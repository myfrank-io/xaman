import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BoatsShell } from "@/components/boats/BoatsShell";
import { NewBoatForm } from "@/components/boats/NewBoatForm";
import { OnboardingSteps } from "@/components/onboarding/OnboardingSteps";
import type { TemplateOption } from "@/lib/boat-onboarding";
import { devUiEnabled } from "@/lib/dev-ui";

/**
 * Visual acceptance of « Ajouter mon bateau » (D65). The real screen only exists for an account
 * with no boat, which nobody on the team has any more — so without this page it would ship
 * having been looked at on one viewport, by accident.
 *
 * The published models are here only to feed the builder and model suggestions: since D65 the
 * screen asks about the boat, never about a maintenance plan.
 */
const TEMPLATES: TemplateOption[] = [
  {
    id: "00000000-0000-4000-8000-0000000000a0",
    name: "ORC 50 — Marsaudon Composites",
    builder: "Marsaudon Composites",
    model: "ORC 50",
    boatType: "catamaran",
    categoryCount: 8,
    itemCount: 93,
  },
  {
    id: "00000000-0000-4000-8000-0000000000a4",
    name: "Oceanis 46.1 — Bénéteau",
    builder: "Bénéteau",
    model: "Oceanis 46.1",
    boatType: "monohull_sail",
    categoryCount: 8,
    itemCount: 74,
  },
  {
    id: "00000000-0000-4000-8000-0000000000a1",
    name: "Catamaran — modèle générique",
    builder: null,
    model: null,
    boatType: "catamaran",
    categoryCount: 8,
    itemCount: 70,
  },
  {
    id: "00000000-0000-4000-8000-0000000000a2",
    name: "Voilier monocoque — modèle générique",
    builder: null,
    model: null,
    boatType: "monohull_sail",
    categoryCount: 8,
    itemCount: 70,
  },
  {
    id: "00000000-0000-4000-8000-0000000000a3",
    name: "Bateau à moteur — modèle générique",
    builder: null,
    model: null,
    boatType: "motor",
    categoryCount: 7,
    itemCount: 64,
  },
];

export default async function DevNewBoatPage() {
  if (!devUiEnabled()) notFound();
  const t = await getTranslations("boats.new");

  return (
    <BoatsShell title={t("title")} subtitle={t("subtitle")}>
      <OnboardingSteps step={1} />
      <NewBoatForm templates={TEMPLATES} />
      <p className="text-caption text-ink-2">{t("invited")}</p>
    </BoatsShell>
  );
}
