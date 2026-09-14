import { planBatch, type Carnet } from "@/lib/inbox/batch-plan";
import { inboxBatchLineSchema, type InboxBatchLine } from "@/lib/schemas/inbox";

import { DevShell } from "../DevShell";
import { DevBatch } from "./DevBatch";

/**
 * « Ce que j'ai lu » (E17-2) on a delivery note, with every state a line can be in on one screen:
 * new, filling a blank, already in the carnet, and — the one that matters — disagreeing with it.
 *
 * The carnet below is deliberately close to Xaman's own: a heater already recorded without its
 * model, a watermaker recorded with a different one. That second row is the whole reason for the
 * screen, and it is the row the touch audit measures, since a divergence is the tallest thing a
 * line can carry.
 */
const line = (over: Partial<InboxBatchLine>): InboxBatchLine =>
  inboxBatchLineSchema.parse({ type: "equipment", label: "", status: "fitted", ...over });

const BATCH: InboxBatchLine[] = [
  line({
    label: "Chauffage Wallas 30DT",
    kindRef: "heater-forced-air",
    brand: "Wallas",
    model: "30DT",
    categoryRef: "plumbing_systems",
    quantity: 2,
    ref: "ACC13",
    documentDate: "2023-01-31",
  }),
  line({
    label: "Dessalinisateur Aqua Base 65 L/h",
    kindRef: "watermaker",
    brand: "Aqua Base",
    model: "65",
    categoryRef: "plumbing_systems",
    documentDate: "2023-01-31",
  }),
  line({
    label: "Emmagasineurs Karver",
    kindRef: "furler",
    brand: "Karver",
    categoryRef: "sails_rigging",
    documentDate: "2023-01-31",
  }),
  line({
    label: "Panneaux solaires back-contact 1 200 Wc",
    kindRef: "solar-panel",
    categoryRef: "energy",
    status: "optional",
    documentDate: "2023-01-31",
  }),
  line({
    label: "Winch électrique pied de mât",
    kindRef: "winch",
    categoryRef: "sails_rigging",
    status: "cancelled",
    documentDate: "2023-01-31",
  }),
  line({
    type: "provider",
    label: "Marsaudon Composites",
    provider: {
      name: "Marsaudon Composites",
      company: null,
      phone: "02 97 00 00 00",
      email: "contact@marsaudon.fr",
      address: "ZA de Kerpont, 56850 Caudan",
    },
    documentDate: "2023-01-31",
  }),
  line({
    type: "identity",
    label: "N° de coque",
    identityField: "hullNumber",
    identityValue: "ORC50-25",
    documentDate: "2023-01-31",
  }),
  line({
    type: "deadline",
    label: "Révision du radeau de survie",
    validUntil: "2029-09-04",
    documentDate: "2023-01-31",
  }),
];

const CARNET: Carnet = {
  equipment: [
    {
      id: "eq-heater",
      name: "Chauffage",
      kindRef: "heater-forced-air",
      brand: "Wallas",
      // No model recorded: the document fills a blank rather than contradicting anything.
      model: null,
      serial: null,
      quantity: 2,
    },
    {
      id: "eq-watermaker",
      name: "Dessalinisateur",
      kindRef: "watermaker",
      brand: "Aqua Base",
      // The carnet says 100 L/h. The document, dated 2023, says 65 — and the carnet wins (D113).
      model: "100",
      serial: null,
      quantity: 1,
    },
  ],
  contacts: [],
  identity: { hullNumber: "ORC50-25" },
};

const CATEGORIES = [
  { externalRef: "sails_rigging", name: "Voiles & Gréement", color: "#7c3aed" },
  { externalRef: "energy", name: "Énergie", color: "#d97706" },
  { externalRef: "plumbing_systems", name: "Hydraulique & Circuits", color: "#0d9488" },
];

const FAMILY_LABELS: Record<string, string> = {
  "heater-forced-air": "Chauffage à air pulsé",
  watermaker: "Dessalinisateur",
  furler: "Emmagasineur / enrouleur",
  "solar-panel": "Panneau solaire",
  winch: "Winch",
};

export default function DevInboxBatchPage() {
  return (
    <DevShell>
      <DevBatch
        planned={planBatch(BATCH, CARNET)}
        categories={CATEGORIES}
        documentFamily="delivery_note"
        documentDate="2023-01-31"
        familyLabels={FAMILY_LABELS}
      />
    </DevShell>
  );
}
