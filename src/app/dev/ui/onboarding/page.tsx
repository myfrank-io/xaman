import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BoatsShell } from "@/components/boats/BoatsShell";
import type { CategoryChoice } from "@/components/common/CategoryChips";
import { LogbookStep } from "@/components/onboarding/LogbookStep";
import { OnboardingSteps } from "@/components/onboarding/OnboardingSteps";
import { TourStep, type TourEngine } from "@/components/onboarding/TourStep";
import { QueryProvider } from "@/components/providers/QueryProvider";
import type { TemplateOption } from "@/lib/boat-onboarding";
import { devUiEnabled } from "@/lib/dev-ui";

import { DEV_BOAT_ID } from "../DevShell";

/**
 * Visual acceptance of steps 2 and 3 of the mise en route (D67) — the two screens that only
 * exist in the minutes after a carnet is opened, and that nobody on the team can reach again.
 *
 * The three panels of step 2 are mounted side by side because the touch audit never clicks: the
 * spreadsheet one carries the whole import wizard, the paper one the document sorter, and those
 * are the two densest surfaces of the flow.
 */
const CATEGORIES: CategoryChoice[] = [
  { id: "c1", name: "Moteurs & Propulsion", color: "#B24A2E", icon: "engine" },
  { id: "c2", name: "Gréement & Voiles", color: "#2F6F8F", icon: "sail" },
  { id: "c3", name: "Coque & Pont", color: "#4C6B52", icon: "hull" },
  { id: "c4", name: "Sécurité", color: "#8A6A2F", icon: "safety" },
];

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
];

const ENGINES: TourEngine[] = [
  { id: "00000000-0000-4000-8000-0000000000b1", label: "Moteur bâbord" },
  { id: "00000000-0000-4000-8000-0000000000b2", label: "Moteur tribord" },
];

export default async function DevOnboardingPage() {
  if (!devUiEnabled()) notFound();
  const t = await getTranslations("boats.onboarding");

  return (
    // The same provider the real screens get from `(app)/layout.tsx`: the paper panel mounts the
    // document sorter, which reads through TanStack Query.
    <QueryProvider>
      <div className="flex flex-col gap-12 pb-16">
        {(["none", "spreadsheet", "paper"] as const).map((format) => (
          <BoatsShell key={format} title="Xaman" subtitle={t("logbook.subtitle")}>
            <OnboardingSteps step={2} />
            <LogbookStep
              boatId={DEV_BOAT_ID}
              categories={CATEGORIES}
              nextHref={`/boats/new/${DEV_BOAT_ID}?step=3`}
              initialFormat={format}
            />
          </BoatsShell>
        ))}

        <BoatsShell title="Xaman" subtitle={t("tour.subtitle")}>
          <OnboardingSteps step={3} />
          <TourStep
            boatId={DEV_BOAT_ID}
            templates={TEMPLATES}
            suggestedTemplateId={TEMPLATES[1]?.id ?? null}
            hasPlan={false}
            engines={ENGINES}
            dashboardHref={`/boats/${DEV_BOAT_ID}/dashboard`}
          />
        </BoatsShell>
      </div>
    </QueryProvider>
  );
}
