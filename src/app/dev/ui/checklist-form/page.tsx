import { ChecklistItemForm } from "@/components/checklist/ChecklistItemForm";
import type { CategoryChoice } from "@/components/common/CategoryChips";
import { SectionCard } from "@/components/common/SectionCard";

import { DEV_BOAT_ID, DevShell } from "../DevShell";

/**
 * Visual acceptance of the checklist point form (E4-6). It had no preview, which is how its
 * category field shipped as the bare word « changer » under a label: opened from the checklist
 * root, no category is preselected, so there was nothing beside the link to say what it did.
 *
 * Two states, because they differ: a new point (no category yet) and an existing one.
 */
const CATEGORIES: CategoryChoice[] = [
  { id: "c1", name: "Moteurs & Propulsion", color: "#B24A2E", icon: "engine" },
  { id: "c2", name: "Voiles & Gréement", color: "#2F6F6B", icon: "sail" },
  { id: "c3", name: "Électricité & Électronique", color: "#3C5A8A", icon: "bolt" },
  { id: "c4", name: "Sécurité", color: "#8A5A1E", icon: "shield" },
  { id: "c5", name: "Coque, Pont & Appendices", color: "#4B6A4E", icon: "hull" },
  { id: "c6", name: "Plomberie & Eaux", color: "#2E6B8A", icon: "water" },
  { id: "c7", name: "Confort & Aménagements", color: "#7A5A7E", icon: "sofa" },
  { id: "c8", name: "Annexe & Hors-bord", color: "#8A7A2E", icon: "dinghy" },
];

const ENGINES = [
  { id: "e1", label: "Bâbord" },
  { id: "e2", label: "Tribord" },
];

export default function DevChecklistFormPage() {
  return (
    <DevShell>
      <div className="flex flex-col gap-10 pb-16">
        <SectionCard title="Nouveau point, sans catégorie choisie" bare>
          <ChecklistItemForm
            boatId={DEV_BOAT_ID}
            categories={CATEGORIES}
            engines={ENGINES}
            item={null}
            defaultCategoryId=""
            existingLabels={["Vidange moteur"]}
          />
        </SectionCard>
        <SectionCard title="Point existant" bare>
          <ChecklistItemForm
            boatId={DEV_BOAT_ID}
            categories={CATEGORIES}
            engines={ENGINES}
            item={{
              id: "00000000-0000-4000-8000-0000000000f1",
              categoryId: "c1",
              label: "Contrôle et remplacement des impellers de pompe à eau de mer",
              description: "Un impeller par moteur. Garder les anciens comme secours.",
              intervalMonths: 12,
              intervalHours: 200,
              engineId: "e1",
              actions: ["Fermer la vanne", "Déposer la trappe", "Remplacer l'impeller"],
              anchorDate: "2026-04-22",
              isActive: true,
              completionsCount: 3,
              updatedAt: "2026-09-03T08:00:00.000Z",
            }}
            defaultCategoryId="c1"
            existingLabels={["Vidange moteur"]}
          />
        </SectionCard>
      </div>
    </DevShell>
  );
}
