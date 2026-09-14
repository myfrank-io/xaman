import { notFound } from "next/navigation";

import { QueueDocument, type QueueRow } from "@/components/report/QueueDocument";

import { DevShell } from "../../DevShell";
import { devUiEnabled } from "@/lib/dev-ui";

/**
 * La liste qu'on emmène, pleine (E18-5, D131).
 *
 * Les cinq raisons d'être sur la feuille sont représentées — en retard, dû dans quelques jours,
 * dû aux heures, en retard aux heures, sans échéance — plus les pièces à racheter : c'est la
 * colonne « Pourquoi » qui décide de la largeur du tableau, donc c'est elle que l'audit tactile
 * doit mesurer sur un écran de 320 px.
 */
const ROWS: QueueRow[] = [
  {
    rank: 0,
    kind: "log",
    id: "l1",
    title: "Fuite au presse-étoupe bâbord",
    category_name: "Propulsion",
    status: "urgent",
    due_at: null,
    due_hours: null,
    days_remaining: null,
    hours_remaining: null,
    severity: 0,
  },
  {
    rank: 1,
    kind: "item",
    id: "i1",
    title: "Vidange moteur bâbord",
    category_name: "Propulsion",
    status: "overdue",
    due_at: "2025-04-02",
    due_hours: null,
    days_remaining: -41,
    hours_remaining: null,
    severity: 41,
  },
  {
    rank: 1,
    kind: "item",
    id: "i2",
    title: "Contrôle des anodes de sail-drive",
    category_name: "Coque et appendices",
    status: "overdue",
    due_at: "2025-05-01",
    due_hours: null,
    days_remaining: -12,
    hours_remaining: null,
    severity: 12,
  },
  {
    rank: 4,
    kind: "item",
    id: "i3",
    title: "Révision du radeau de survie",
    category_name: "Sécurité",
    status: "soon",
    due_at: "2025-06-01",
    due_hours: null,
    days_remaining: 19,
    hours_remaining: null,
    severity: 0,
  },
  {
    rank: 4,
    kind: "item",
    id: "i4",
    title: "Remplacement de l'impeller",
    category_name: "Propulsion",
    status: "soon",
    due_at: null,
    due_hours: 1250,
    days_remaining: null,
    hours_remaining: 38,
    severity: 0,
  },
  {
    rank: 1,
    kind: "item",
    id: "i5",
    title: "Contrôle de la courroie d'alternateur",
    category_name: "Propulsion",
    status: "overdue",
    due_at: null,
    due_hours: 1100,
    days_remaining: null,
    hours_remaining: -22,
    severity: 22,
  },
  {
    rank: 3,
    kind: "log",
    id: "l2",
    title: "Devis en attente — réfection du pont",
    category_name: "Pont et gréement",
    status: "planned",
    due_at: null,
    due_hours: null,
    days_remaining: null,
    hours_remaining: null,
    severity: 0,
  },
  {
    rank: 5,
    kind: "part",
    id: "p1",
    title: "Filtre à huile Yanmar 119305-35151",
    category_name: "Propulsion",
    status: null,
    due_at: null,
    due_hours: null,
    days_remaining: null,
    hours_remaining: null,
    severity: 2,
  },
  {
    rank: 5,
    kind: "part",
    id: "p2",
    title: "Anode de sail-drive",
    category_name: "Coque et appendices",
    status: null,
    due_at: null,
    due_hours: null,
    days_remaining: null,
    hours_remaining: null,
    severity: 4,
  },
];

export default async function DevQueueReportPage() {
  if (!devUiEnabled()) notFound();
  return (
    <DevShell>
      <QueueDocument boatName="Xaman" today="2025-05-13" rows={ROWS} />
    </DevShell>
  );
}
