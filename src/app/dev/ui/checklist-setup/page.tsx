import {
  StartupWizard,
  type WizardCategory,
  type WizardEngine,
} from "@/components/checklist/StartupWizard";

import { DEV_BOAT_ID, DevShell } from "../DevShell";

/**
 * Visual acceptance of the start-up wizard (E4-9) — the first thing anyone does with a new
 * boat, and a screen nobody sees twice, so it was never re-opened once it worked on a desk.
 * Three steps: engine counters, the points to keep, the rough age of the last completion.
 */
const ENGINES: WizardEngine[] = [
  { id: "e1", label: "Bâbord", lastHours: 1482.5, lastDate: "2026-08-28" },
  { id: "e2", label: "Tribord", lastHours: null, lastDate: null },
];

const CATEGORIES: WizardCategory[] = [
  {
    id: "c1",
    name: "Moteurs & Propulsion",
    color: "#B24A2E",
    icon: "engine",
    items: [
      {
        id: "i1",
        label: "Vidange moteur et remplacement du filtre à huile",
        intervalMonths: 12,
        intervalHours: 200,
      },
      {
        id: "i2",
        label: "Contrôle et remplacement des impellers de pompe à eau de mer",
        intervalMonths: 12,
        intervalHours: null,
      },
      { id: "i3", label: "Anodes de saildrive", intervalMonths: 12, intervalHours: null },
    ],
  },
  {
    id: "c2",
    name: "Voiles & Gréement",
    color: "#2F6F6B",
    icon: "sail",
    items: [
      {
        id: "i4",
        label: "Contrôle du gréement dormant (ridoirs, cadènes, sertissages)",
        intervalMonths: 24,
        intervalHours: null,
      },
      {
        id: "i5",
        label: "Révision de l'emmagasineur de Code 0",
        intervalMonths: 12,
        intervalHours: null,
      },
    ],
  },
  {
    id: "c3",
    name: "Sécurité",
    color: "#8A5A1E",
    icon: "shield",
    items: [
      {
        id: "i6",
        label: "Contrôle annuel du radeau de survie",
        intervalMonths: 12,
        intervalHours: null,
      },
      {
        id: "i7",
        label: "Percussion et pesée des gilets gonflables",
        intervalMonths: 12,
        intervalHours: null,
      },
      { id: "i8", label: "Vérification des extincteurs", intervalMonths: 12, intervalHours: null },
    ],
  },
];

export default function DevChecklistSetupPage() {
  return (
    <DevShell>
      {/* The three steps side by side: only the first is reachable without clicking, and the
          second — one toggle per checklist point — is the one that has to survive a phone. */}
      <div className="flex flex-col gap-10 pb-16">
        {([1, 2, 3] as const).map((step) => (
          <StartupWizard
            key={step}
            boatId={DEV_BOAT_ID}
            engines={ENGINES}
            categories={CATEGORIES}
            initialStep={step}
          />
        ))}
      </div>
    </DevShell>
  );
}
