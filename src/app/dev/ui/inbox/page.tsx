import { notFound } from "next/navigation";

import { InboxScreen } from "@/components/inbox/InboxScreen";
import { devUiEnabled } from "@/lib/dev-ui";
import type { InboxItem } from "@/lib/queries/inbox";

import { DEV_BOAT_ID, DevShell } from "../DevShell";
import { SAMPLE_CATEGORIES } from "../sample-data";

/**
 * « À valider » (D91) under the touch audit: a document being read, one read and waiting, one
 * the reading could not handle, and two already filed — every state of a card on one screen.
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
  validatedAt: null,
  updatedAt: NOW,
  error: null,
  suggestion: null,
};

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
      contactId: CONTACT,
      categoryId: CATEGORY,
      engineHours: [{ engineId: ENGINE, hours: 1284 }],
      lineItems: [
        { designation: "Huile moteur 15W40 — 8 L", amount: 96 },
        { designation: "Filtres à huile ×2", amount: 54.4 },
        { designation: "Main-d'œuvre — 3 h", amount: 336 },
      ],
      notes: "Vidange des deux Yanmar avec filtres. Heures relevées sur le moteur bâbord.",
      confidence: "medium",
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
      contactId: null,
      categoryId: null,
      engineHours: [],
      lineItems: [],
      notes: null,
      confidence: "high",
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
        canContribute
        canWrite
        inboxAddress="xaman-3f9a1c2b7d4e@carnet.xaman.boats"
      />
    </DevShell>
  );
}
