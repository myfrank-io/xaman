import { ReviewTable } from "@/components/review/ReviewTable";
import type { ReviewLog, ReviewPurchase } from "@/components/review/review-rows";

import { DevShell, DEV_BOAT_ID } from "../DevShell";

// The paper logbook, as it really looks: SB and BB probably swapped on 28/08, and one value
// going backwards (E3-7, D24).
const LOGS: ReviewLog[] = [
  {
    id: "review-1",
    title: "Check niveaux",
    performedAt: "2025-04-23",
    categoryName: "Moteurs",
    categoryColor: "#D97706",
    contactName: null,
    notes: "Carnet : « Niveaux OK. SB 502 h, BB 876 h ».",
    hours: [
      {
        engineId: "engine-sb",
        engineLabel: "Moteur SB",
        bookHours: 502,
        previous: null,
        next: { hours: 625, date: "2025-08-28" },
      },
      {
        engineId: "engine-bb",
        engineLabel: "Moteur BB",
        bookHours: 876,
        previous: null,
        next: { hours: 658, date: "2025-08-28" },
      },
    ],
  },
  {
    id: "review-2",
    title: "Huile moteur, courroie",
    performedAt: "2025-08-28",
    categoryName: "Moteurs",
    categoryColor: "#D97706",
    contactName: null,
    notes:
      "Carnet : « Huile moteur, courroie retour OK. SB 625 h, BB 658 h (BB inférieur au relevé d'avril : à vérifier) ».",
    hours: [
      {
        engineId: "engine-sb",
        engineLabel: "Moteur SB",
        bookHours: 625,
        previous: { hours: 502, date: "2025-04-23" },
        next: { hours: 708, date: "2025-10-20" },
      },
      {
        engineId: "engine-bb",
        engineLabel: "Moteur BB",
        bookHours: 658,
        previous: { hours: 876, date: "2025-04-23" },
        next: { hours: 642, date: "2025-10-20" },
      },
    ],
  },
];

const PURCHASES: ReviewPurchase[] = [
  { id: "purchase-1", purchasedAt: "2025-05-02", designation: "Bouteille de gaz", amount: 38 },
  { id: "purchase-2", purchasedAt: "2025-09-14", designation: "Filtres à gasoil ×4", amount: 62.4 },
];

/** Visual acceptance of « Reprise du carnet » (E3-7) without Supabase. */
export default async function DevReviewPage() {
  return (
    <DevShell>
      <div className="flex flex-col gap-6 pb-16">
        <div>
          <h1 className="text-h1">Vérifier les lignes importées</h1>
          <p className="mt-1 text-body text-ink-2">
            La deuxième ligne recule de 218 h sur le moteur BB : le contexte le dit en rouge, et «
            Intervertir » règle l&apos;hypothèse SB ↔ BB en un tap.
          </p>
        </div>
        <ReviewTable boatId={DEV_BOAT_ID} logs={LOGS} purchases={PURCHASES} />
      </div>
    </DevShell>
  );
}
