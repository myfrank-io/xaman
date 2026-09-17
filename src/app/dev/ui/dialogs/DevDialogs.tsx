"use client";

import { useState } from "react";

import { CompleteItemDialog } from "@/components/checklist/CompleteItemDialog";
import { HandOverDialog } from "@/components/checklist/HandOverDialog";
import type { ChecklistRow } from "@/components/checklist/rows";
import { QuickContactDialog } from "@/components/contacts/QuickContactDialog";
import { EditReadingDialog } from "@/components/engines/EditReadingDialog";
import { HourReadingDialog } from "@/components/engines/HourReadingDialog";
import { RecurringItemDialog } from "@/components/logs/RecurringItemDialog";
import { Button } from "@/components/ui/button";

const BOAT = "00000000-0000-4000-8000-000000000000";

export type DevDialogKey =
  "complete" | "hours" | "edit-reading" | "contact" | "recurring" | "handoff";

const LABELS: Record<DevDialogKey, string> = {
  complete: "Marquer comme fait",
  hours: "Relevé de compteur",
  "edit-reading": "Modifier un relevé",
  contact: "Nouveau prestataire",
  recurring: "Point récurrent",
  handoff: "Confier au chantier",
};

/** Le point que la feuille « Confier au chantier » reçoit (D141) : en retard, aux heures. */
const HANDOFF_ROW: ChecklistRow = {
  id: "i-handoff",
  label: "Vidange moteur bâbord",
  description: null,
  actions: [],
  categoryId: "c-engines",
  categoryName: "Moteurs & Propulsion",
  categoryColor: "#D97706",
  engineId: "e1",
  engineLabel: "Bâbord",
  engineTracksHours: true,
  intervalMonths: 12,
  intervalHours: 250,
  sortOrder: 1,
  anchorDate: null,
  anchorHours: null,
  counterResetAt: null,
  currentHours: 1482.5,
  hasCompletion: true,
  lastCompletionId: null,
  lastCompletedAt: "2025-09-14",
  lastCompletedByName: "Chantier Naval du Guip",
  lastEngineHours: 1204,
  fixedDueAt: null,
  status: "overdue",
  dueAt: "2026-09-14",
  dueHours: 1454,
  daysRemaining: -3,
  hoursRemaining: -28.5,
  openLog: null,
};

const HANDOFF_CONTACTS = [
  {
    id: "c1",
    name: "Marsaudon Composites",
    specialty: "Chantier constructeur",
    company: "Marsaudon Composites SAS",
    phone: "02 97 83 01 31",
    email: "contact@marsaudon-composites.com",
  },
  {
    id: "c2",
    name: "Motoriste Yanmar Lorient",
    specialty: "Motoriste",
    company: null,
    phone: null,
    email: null,
  },
];

/**
 * One dialog at a time, chosen by `?d=`.
 *
 * A dialog is closed on load, so the touch audit — which opens a URL and measures what it
 * finds — had never seen inside any of them. They are the densest surfaces in the app: a date,
 * a counter, a picker and a note in a box that must fit above the keyboard on a 320 px phone.
 * Opening exactly one keeps the measurement honest; several stacked would overlap.
 */
export function DevDialogs({ which }: { which: DevDialogKey | null }) {
  const [open, setOpen] = useState<DevDialogKey | null>(which);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as DevDialogKey[]).map((key) => (
          <Button key={key} type="button" variant="outline" onClick={() => setOpen(key)}>
            {LABELS[key]}
          </Button>
        ))}
      </div>

      <CompleteItemDialog
        boatId={BOAT}
        item={
          open === "complete"
            ? {
                id: "i1",
                label: "Contrôle et remplacement des impellers de pompe à eau de mer",
                categoryName: "Moteurs & Propulsion",
                intervalMonths: 12,
                intervalHours: 200,
                engine: {
                  id: "e1",
                  label: "Bâbord",
                  lastHours: 1482.5,
                  lastDate: "2026-08-28",
                  tracksHours: true,
                },
                lastCompletedAt: "2025-09-14",
                lastCompletedByName: "Chantier Naval du Guip",
                lastEngineHours: 1204,
              }
            : null
        }
        members={[
          { id: "m1", name: "Xavier Marin" },
          { id: "m2", name: "Emmanuel Lesaffre" },
        ]}
        currentUserId="m1"
        currentUserName="Xavier Marin"
        onOpenChange={(next) => setOpen(next ? "complete" : null)}
      />

      <HandOverDialog
        boatId={BOAT}
        row={open === "handoff" ? HANDOFF_ROW : null}
        contacts={HANDOFF_CONTACTS}
        defaultContactId="c1"
        canCreateContact
        onOpenChange={(next) => setOpen(next ? "handoff" : null)}
      />

      <HourReadingDialog
        boatId={BOAT}
        engines={[
          { id: "e1", label: "Bâbord", lastHours: 1482.5, lastDate: "2026-08-28" },
          { id: "e2", label: "Tribord", lastHours: 1461, lastDate: "2026-08-28" },
        ]}
        open={open === "hours"}
        onOpenChange={(next) => setOpen(next ? "hours" : null)}
        canResetCounter
      />

      <EditReadingDialog
        boatId={BOAT}
        reading={
          open === "edit-reading"
            ? {
                id: "r1",
                hours: 1482.5,
                readAt: "2026-08-28",
                note: "Relevé au retour de la Trinité, moteur froid.",
                updatedAt: "2026-09-03T08:00:00.000Z",
              }
            : null
        }
        onOpenChange={(next) => setOpen(next ? "edit-reading" : null)}
      />

      <QuickContactDialog
        boatId={BOAT}
        open={open === "contact"}
        onOpenChange={(next) => setOpen(next ? "contact" : null)}
        onCreated={() => setOpen(null)}
      />

      <RecurringItemDialog
        boatId={BOAT}
        logId="00000000-0000-4000-8000-0000000000d1"
        title="Remplacement du guindant du Code 0 et révision de l'emmagasineur"
        engineHours={[
          { engineId: "e1", label: "Bâbord", hours: 1482.5 },
          { engineId: "e2", label: "Tribord", hours: 1461 },
        ]}
        open={open === "recurring"}
        onOpenChange={(next) => setOpen(next ? "recurring" : null)}
      />
    </div>
  );
}
