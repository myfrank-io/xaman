import { notFound } from "next/navigation";

import { InboxScreen } from "@/components/inbox/InboxScreen";
import { devUiEnabled } from "@/lib/dev-ui";
import type { InboxItem } from "@/lib/queries/inbox";

import { DEV_BOAT_ID, DevShell } from "../DevShell";
import { SAMPLE_CATEGORIES } from "../sample-data";

/**
 * « À valider » (D91) under the touch audit: a document being read, one read with something to
 * check (which opens on the full form), one the reading could not handle, two read without a
 * single reserve (which open on one line, and together bring out « Tout valider »), two already
 * filed, and an inventory read off a builder's list (D126), whose card sends its lines to the
 * equipment import — every state of a card on one screen.
 */
const NOW = "2026-09-08T10:00:00.000Z";
const CATEGORY = SAMPLE_CATEGORIES[0]?.id ?? "";
const ENGINE = "00000000-0000-4000-8000-00000000e001";
const CONTACT = "00000000-0000-4000-8000-00000000d001";

const base = {
  storagePath: "",
  url: null,
  logId: null,
  purchaseId: null,
  completionId: null,
  validatedAt: null,
  updatedAt: NOW,
  error: null,
  suggestion: null,
};

const POINT = "00000000-0000-4000-8000-000000003001";

const ITEMS: InboxItem[] = [
  {
    ...base,
    id: "00000000-0000-4000-8000-000000009001",
    source: "email",
    status: "analysing",
    receivedAt: NOW,
    senderEmail: "compta@chantier-naval.fr",
    senderName: "Chantier Naval de la Ciotat",
    subject: "Facture 2026-118 — Xaman",
    fileName: "facture-2026-118.pdf",
    mimeType: "application/pdf",
    sizeBytes: 184_320,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000009002",
    source: "email",
    status: "ready",
    receivedAt: "2026-09-07T16:20:00.000Z",
    senderEmail: "compta@chantier-naval.fr",
    senderName: "Chantier Naval de la Ciotat",
    subject: "Facture 2026-117 — vidange moteurs",
    fileName: "facture-2026-117.pdf",
    mimeType: "application/pdf",
    sizeBytes: 203_776,
    suggestion: {
      documentType: "invoice",
      kind: "log",
      purchaseKind: "service",
      title: "Vidange des deux moteurs et remplacement des filtres",
      date: "2026-09-05",
      amount: 486.4,
      currency: "EUR",
      supplierName: "Chantier Naval de la Ciotat",
      supplier: {
        name: "Chantier Naval de la Ciotat",
        company: null,
        phone: "04 42 08 12 34",
        email: "compta@chantier-naval.fr",
        address: "Quai Ganteaume, 13600 La Ciotat",
      },
      contactId: CONTACT,
      categoryId: CATEGORY,
      engineHours: [{ engineId: ENGINE, hours: 1284 }],
      lineItems: [
        { designation: "Huile moteur 15W40 — 8 L", amount: 96 },
        { designation: "Filtres à huile ×2", amount: 54.4 },
        { designation: "Main-d'œuvre — 3 h", amount: 336 },
      ],
      notes: "Vidange des deux Yanmar avec filtres. Heures relevées sur le moteur bâbord.",
      checklistItemId: null,
      validUntil: null,
      confidence: "medium",
      inventory: [],
      warnings: ["local", "Le relevé d'heures du moteur tribord n'est pas lisible sur la facture."],
    },
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000009003",
    source: "upload",
    status: "ready",
    receivedAt: "2026-09-06T09:12:00.000Z",
    senderEmail: null,
    senderName: null,
    subject: null,
    fileName: "IMG_4412.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1_204_224,
    error: "analysis",
  },
  // Two documents the reading had nothing to flag: each opens on its one line and its « Valider »
  // (« Modifier » brings the form back), and together they put « Tout valider » above the list.
  // Purchases, because a sample category id is not a uuid and an intervention needs one.
  {
    ...base,
    id: "00000000-0000-4000-8000-000000009006",
    source: "upload",
    status: "ready",
    receivedAt: "2026-09-04T11:40:00.000Z",
    senderEmail: null,
    senderName: null,
    subject: null,
    fileName: "ticket-manilles.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 612_000,
    suggestion: {
      documentType: "receipt",
      kind: "purchase",
      purchaseKind: "part",
      title: "Manilles inox 8 mm ×4",
      date: "2026-09-04",
      amount: 24.9,
      currency: "EUR",
      supplierName: "Accastillage Diffusion",
      supplier: {
        name: "Accastillage Diffusion",
        company: null,
        phone: "04 42 08 12 34",
        email: "compta@chantier-naval.fr",
        address: "Quai Ganteaume, 13600 La Ciotat",
      },
      contactId: null,
      categoryId: null,
      engineHours: [],
      lineItems: [],
      notes: null,
      checklistItemId: null,
      validUntil: null,
      confidence: "high",
      inventory: [],
      warnings: ["local"],
    },
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000009007",
    source: "email",
    status: "ready",
    receivedAt: "2026-09-03T08:05:00.000Z",
    senderEmail: "capitainerie@port-laciotat.fr",
    senderName: "Port de La Ciotat",
    subject: "Facture place de port — septembre",
    fileName: "place-de-port-septembre.pdf",
    mimeType: "application/pdf",
    sizeBytes: 98_304,
    suggestion: {
      documentType: "invoice",
      kind: "purchase",
      purchaseKind: "service",
      title: "Place de port — septembre 2026",
      date: "2026-09-01",
      amount: 412,
      currency: "EUR",
      supplierName: "Port de La Ciotat",
      supplier: {
        name: "Port de La Ciotat",
        company: null,
        phone: "04 42 08 12 34",
        email: "compta@chantier-naval.fr",
        address: "Quai Ganteaume, 13600 La Ciotat",
      },
      contactId: null,
      categoryId: null,
      engineHours: [],
      lineItems: [],
      notes: null,
      checklistItemId: null,
      validUntil: null,
      confidence: "high",
      inventory: [],
      warnings: ["local"],
    },
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000009004",
    source: "upload",
    status: "validated",
    receivedAt: "2026-09-01T09:12:00.000Z",
    validatedAt: "2026-09-01T09:15:00.000Z",
    senderEmail: null,
    senderName: null,
    subject: null,
    fileName: "ticket-accastillage.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 842_000,
    purchaseId: "00000000-0000-4000-8000-000000007001",
    suggestion: {
      documentType: "receipt",
      kind: "purchase",
      purchaseKind: "part",
      title: "Manilles inox 10 mm ×4",
      date: "2026-09-01",
      amount: 38.9,
      currency: "EUR",
      supplierName: "Accastillage Diffusion",
      supplier: {
        name: "Accastillage Diffusion",
        company: null,
        phone: "04 42 08 12 34",
        email: "compta@chantier-naval.fr",
        address: "Quai Ganteaume, 13600 La Ciotat",
      },
      contactId: null,
      categoryId: null,
      engineHours: [],
      lineItems: [],
      notes: null,
      checklistItemId: null,
      validUntil: null,
      confidence: "high",
      inventory: [],
      warnings: [],
    },
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000009005",
    source: "email",
    status: "dismissed",
    receivedAt: "2026-08-28T09:12:00.000Z",
    validatedAt: "2026-08-28T10:00:00.000Z",
    senderEmail: "newsletter@shipchandler.example",
    senderName: null,
    subject: "Promo de rentrée",
    fileName: "promo.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2_048_000,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000009008",
    source: "email",
    status: "ready",
    receivedAt: "2026-09-06T08:05:00.000Z",
    senderEmail: "contact@survitec-marseille.fr",
    senderName: "Survitec Marseille",
    subject: "Révision radeau — Xaman",
    fileName: "pv-revision-radeau-2026.pdf",
    mimeType: "application/pdf",
    sizeBytes: 96_512,
    suggestion: {
      documentType: "certificate",
      kind: "deadline",
      purchaseKind: "service",
      title: "Révision du radeau de survie",
      date: "2026-09-04",
      amount: null,
      currency: null,
      supplierName: "Survitec Marseille",
      supplier: {
        name: "Survitec Marseille",
        company: null,
        phone: "04 91 02 33 44",
        email: "contact@survitec-marseille.fr",
        address: "18 quai du Lazaret, 13002 Marseille",
      },
      contactId: null,
      categoryId: null,
      engineHours: [],
      lineItems: [],
      notes: "Radeau 10 personnes, conteneur rigide. Prochaine révision à trois ans.",
      checklistItemId: POINT,
      validUntil: "2029-09-04",
      confidence: "high",
      inventory: [],
      warnings: [],
    },
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000009009",
    source: "email",
    status: "ready",
    receivedAt: "2026-09-08T08:05:00.000Z",
    senderEmail: "livraison@chantier-naval.fr",
    senderName: "Chantier Naval de la Ciotat",
    subject: "Xaman — liste des équipements livrés",
    fileName: "inventaire-livraison.pdf",
    mimeType: "application/pdf",
    sizeBytes: 512_000,
    suggestion: {
      documentType: "other",
      kind: "inventory",
      purchaseKind: "service",
      title: "Inventaire de livraison — ORC 50 Xaman",
      date: "2026-09-01",
      amount: null,
      currency: null,
      supplierName: "Chantier Naval de la Ciotat",
      supplier: {
        name: "Chantier Naval de la Ciotat",
        company: null,
        phone: null,
        email: "livraison@chantier-naval.fr",
        address: null,
      },
      contactId: null,
      categoryId: null,
      engineHours: [],
      lineItems: [],
      notes: null,
      checklistItemId: null,
      validUntil: null,
      confidence: "high",
      inventory: [
        {
          name: "Grand-voile",
          brand: "Incidence",
          model: "Hydranet Radial",
          serial: null,
          quantity: 1,
          categoryId: "sails",
          installedAt: "2026-08-28",
          specs: [
            { key: "surface_m2", value: "88" },
            { key: "tissu", value: "Hydranet" },
            { key: "lattes", value: "5 lattes forcées" },
          ],
        },
        {
          name: "Génois sur enrouleur",
          brand: "Incidence",
          model: null,
          serial: null,
          quantity: 1,
          categoryId: "sails",
          installedAt: "2026-08-28",
          specs: [{ key: "surface_m2", value: "62" }],
        },
        {
          name: "Parc batteries lithium",
          brand: "Victron",
          model: "Smart LiFePO4",
          serial: "VE-2026-00871",
          quantity: 4,
          categoryId: "energy",
          installedAt: "2026-07-14",
          specs: [
            { key: "capacite_ah", value: "210" },
            { key: "tension_v", value: "12" },
          ],
        },
        {
          name: "Panneaux solaires de roof",
          brand: "Solbian",
          model: "SP144",
          serial: null,
          quantity: 6,
          categoryId: "energy",
          installedAt: "2026-07-14",
          specs: [{ key: "puissance_w", value: "864" }],
        },
        {
          name: "Radeau de survie 8 places",
          brand: "Plastimo",
          model: "Transocean ISO 9650-1",
          serial: "PL-88412",
          quantity: 1,
          categoryId: "safety",
          installedAt: "2026-06-02",
          specs: [{ key: "places", value: "8" }],
        },
        {
          name: "Guindeau électrique",
          brand: "Lofrans",
          model: "Tigres",
          serial: null,
          quantity: 1,
          categoryId: "hull",
          installedAt: null,
          specs: [{ key: "puissance_w", value: "1500" }],
        },
      ],
      warnings: [],
    },
  },
];

export default function DevInboxPage() {
  if (!devUiEnabled()) notFound();
  return (
    <DevShell>
      <InboxScreen
        boatId={DEV_BOAT_ID}
        pending={ITEMS.filter((item) => item.status !== "validated" && item.status !== "dismissed")}
        done={ITEMS.filter((item) => item.status === "validated" || item.status === "dismissed")}
        categories={[...SAMPLE_CATEGORIES]}
        engines={[
          { id: ENGINE, label: "Moteur bâbord" },
          { id: "00000000-0000-4000-8000-00000000e002", label: "Moteur tribord" },
        ]}
        contacts={[
          { id: CONTACT, name: "Chantier Naval de la Ciotat", specialty: "Chantier carénage" },
        ]}
        logs={[
          {
            id: "00000000-0000-4000-8000-000000002001",
            title: "Vidange des deux moteurs",
            performedAt: "2026-08-12",
          },
          {
            id: "00000000-0000-4000-8000-000000002002",
            title: "Antifouling et anodes",
            performedAt: "2026-05-03",
          },
        ]}
        deadlineItems={[
          {
            id: POINT,
            label: "Radeau de survie : révision",
            categoryName: "Sécurité",
            categoryId: "00000000-0000-4000-8000-0000000000c8",
          },
          {
            id: "00000000-0000-4000-8000-000000003002",
            label: "Extincteurs : contrôle",
            categoryName: "Sécurité",
            categoryId: "00000000-0000-4000-8000-0000000000c8",
          },
          {
            id: "00000000-0000-4000-8000-000000003003",
            label: "Assurance du bateau : renouvellement",
            categoryName: "Sécurité",
            categoryId: "00000000-0000-4000-8000-0000000000c8",
          },
        ]}
        canContribute
        canWrite
        inboxAddress="xaman-3f9a1c2b7d4e@carnet.xaman.boats"
      />
    </DevShell>
  );
}
