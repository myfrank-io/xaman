import { notFound } from "next/navigation";

import { ChoosePlanBlock } from "@/components/checklist/ChoosePlanBlock";
import type { TemplateOption } from "@/lib/boat-onboarding";
import { devUiEnabled } from "@/lib/dev-ui";

import { DEV_BOAT_ID, DevShell } from "../DevShell";

/**
 * Visual acceptance of « Choisir un plan d'entretien » (D65) — the second half of the split
 * onboarding, and a block that only ever appears on a boat created minutes earlier.
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

export default function DevChecklistPlanPage() {
  if (!devUiEnabled()) notFound();
  return (
    <DevShell>
      <ChoosePlanBlock
        boatId={DEV_BOAT_ID}
        templates={TEMPLATES}
        suggestedTemplateId="00000000-0000-4000-8000-0000000000a1"
      />
    </DevShell>
  );
}
