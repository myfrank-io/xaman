import type { AttachmentItem } from "@/lib/queries/attachments";

import { DEV_BOAT_ID } from "../DevShell";

const OWNER = "00000000-0000-4000-8000-0000000000a1";

/**
 * A 4:3 slate-blue rectangle as a data URI: the gallery must be judged on its frames, its
 * legends and its rhythm, not on a photograph nobody in the repository owns.
 */
const SAMPLE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
       <rect width="400" height="300" fill="#33475B"/>
       <rect x="40" y="60" width="320" height="180" rx="8" fill="#8A99AC"/>
       <rect x="70" y="95" width="200" height="14" rx="7" fill="#F4F6F8"/>
       <rect x="70" y="125" width="260" height="10" rx="5" fill="#D8DEE5"/>
       <rect x="70" y="150" width="230" height="10" rx="5" fill="#D8DEE5"/>
       <rect x="70" y="190" width="120" height="18" rx="9" fill="#F4F6F8"/>
     </svg>`,
  );

function path(name: string): string {
  return `boats/${DEV_BOAT_ID}/maintenance_log/${OWNER}/${name}`;
}

export const DEV_ATTACHMENTS: AttachmentItem[] = [
  {
    id: "00000000-0000-4000-8000-0000000000f1",
    fileName: "facture-motoriste.pdf",
    mimeType: "application/pdf",
    sizeBytes: 384_120,
    caption: "Facture Yanmar — vidange et filtres",
    storagePath: path("facture-motoriste.pdf"),
    createdAt: "2026-03-06T18:22:00.000Z",
    createdByName: "Xavier Marin",
    url: "#",
  },
  {
    id: "00000000-0000-4000-8000-0000000000f2",
    fileName: "moteur-sb-avant.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 612_000,
    caption: "Moteur SB avant intervention",
    storagePath: path("moteur-sb-avant.jpg"),
    createdAt: "2026-03-06T18:24:00.000Z",
    createdByName: "Xavier Marin",
    url: SAMPLE_IMAGE,
  },
  {
    id: "00000000-0000-4000-8000-0000000000f3",
    fileName: "courroie-neuve.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 448_300,
    caption: null,
    storagePath: path("courroie-neuve.jpg"),
    createdAt: "2026-03-06T18:31:00.000Z",
    createdByName: "Emmanuel Lesaffre",
    url: SAMPLE_IMAGE,
  },
  {
    id: "00000000-0000-4000-8000-0000000000f4",
    fileName: "photo-perdue.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 120_400,
    caption: "Objet illisible : l'aperçu le dit au lieu de casser",
    storagePath: path("photo-perdue.jpg"),
    createdAt: "2026-03-07T08:00:00.000Z",
    createdByName: null,
    url: null,
  },
];

export const DEV_ATTACHMENT_OWNER = OWNER;

export const DEV_DOCUMENT_LOGS = [
  {
    id: "00000000-0000-4000-8000-0000000000b1",
    title: "Vidange moteur SB",
    performedAt: "2026-03-06",
  },
  { id: "00000000-0000-4000-8000-0000000000b2", title: "Antifouling", performedAt: "2026-01-18" },
  {
    id: "00000000-0000-4000-8000-0000000000b3",
    title: "Révision guindeau",
    performedAt: "2025-11-02",
  },
];
