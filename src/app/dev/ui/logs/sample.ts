import type { ContactOption } from "@/components/contacts/specialties";
import type { LogDetailCompletion, LogDetailData } from "@/components/logs/LogDetail";
import type { LogFormChoice, LogFormEngine } from "@/components/logs/log-form-values";
import type { LogRow } from "@/components/logs/rows";
import type { ItemSuggestion, TitleSuggestion } from "@/lib/actions/logs";

import { SAMPLE_CATEGORIES } from "../sample-data";

// Fake journal data for the visual gallery: no seed, no database (BACKLOG E3-2/E3-3 acceptance).
const ENGINES_CATEGORY = SAMPLE_CATEGORIES[0];
const SAILS_CATEGORY = SAMPLE_CATEGORIES[2];
const HULL_CATEGORY = SAMPLE_CATEGORIES[3];
const SAFETY_CATEGORY = SAMPLE_CATEGORIES[7];

export const DEV_ENGINES: LogFormEngine[] = [
  { id: "engine-sb", label: "Moteur SB", lastHours: 1234, lastDate: "2026-08-28" },
  { id: "engine-bb", label: "Moteur BB", lastHours: 1208, lastDate: "2026-08-28" },
  { id: "engine-annex", label: "Annexe", lastHours: null, lastDate: null },
];

export const DEV_CONTACTS: ContactOption[] = [
  { id: "contact-yard", name: "Chantier Naval de Hyères", specialty: "Chantier carénage" },
  { id: "contact-engine", name: "Motoriste Yanmar", specialty: "Motoriste" },
];

export const DEV_EQUIPMENT: LogFormChoice[] = [
  { id: "equip-1", label: "Moteur SB · Yanmar 4JH45" },
  { id: "equip-2", label: "Guindeau · Lofrans" },
];

export const DEV_HAUL_OUTS: LogFormChoice[] = [
  { id: "haul-1", label: "10/01/2026 · Chantier Naval de Hyères" },
];

export const DEV_TITLE_SUGGESTIONS: TitleSuggestion[] = [
  {
    title: "Vidange moteur SB",
    categoryId: ENGINES_CATEGORY.id,
    engineId: "engine-sb",
    occurrences: 3,
    lastPerformedAt: "2026-03-06",
  },
  {
    title: "Vidange moteur BB",
    categoryId: ENGINES_CATEGORY.id,
    engineId: "engine-bb",
    occurrences: 2,
    lastPerformedAt: "2026-03-06",
  },
  {
    title: "Vidange + entretien complet (2 moteurs)",
    categoryId: ENGINES_CATEGORY.id,
    engineId: null,
    occurrences: 1,
    lastPerformedAt: "2025-04-23",
  },
];

export const DEV_ITEM_SUGGESTIONS: ItemSuggestion[] = [
  {
    id: "item-oil-sb",
    label: "Vidange huile moteur + filtre à huile — Moteur SB",
    engineId: "engine-sb",
    engineLabel: "Moteur SB",
    intervalMonths: 12,
    intervalHours: 250,
    status: "overdue",
    daysRemaining: -126,
    hoursRemaining: -18,
    currentHours: 1234,
    score: 0.71,
  },
  {
    id: "item-fuel-sb",
    label: "Filtres à gasoil — Moteur SB",
    engineId: "engine-sb",
    engineLabel: "Moteur SB",
    intervalMonths: 12,
    intervalHours: 250,
    status: "ok",
    daysRemaining: 180,
    hoursRemaining: 120,
    currentHours: 1234,
    score: 0.56,
  },
  {
    id: "item-oil-bb",
    label: "Vidange huile moteur + filtre à huile — Moteur BB",
    engineId: "engine-bb",
    engineLabel: "Moteur BB",
    intervalMonths: 12,
    intervalHours: 250,
    status: "soon",
    daysRemaining: 21,
    hoursRemaining: 40,
    currentHours: 1208,
    score: 0.68,
  },
];

export const DEV_LOG_ROWS: LogRow[] = [
  {
    id: "log-1",
    title: "Niveaux + courroie",
    performedAt: "2026-03-25",
    status: "done",
    categoryId: ENGINES_CATEGORY.id,
    categoryName: ENGINES_CATEGORY.name,
    categoryColor: ENGINES_CATEGORY.color,
    contactName: null,
    cost: null,
    needsReview: true,
    engineHours: [{ engineId: "engine-bb", label: "Moteur BB", hours: 1008 }],
    updatedAt: "2026-03-25T10:00:00.000Z",
  },
  {
    id: "log-2",
    title: "Vidange + entretien complet (2 moteurs)",
    performedAt: "2026-03-06",
    status: "done",
    categoryId: ENGINES_CATEGORY.id,
    categoryName: ENGINES_CATEGORY.name,
    categoryColor: ENGINES_CATEGORY.color,
    contactName: "Motoriste Yanmar",
    cost: 620,
    needsReview: false,
    engineHours: [
      { engineId: "engine-sb", label: "Moteur SB", hours: 1256 },
      { engineId: "engine-bb", label: "Moteur BB", hours: 1208 },
    ],
    updatedAt: "2026-03-06T10:00:00.000Z",
  },
  {
    id: "log-3",
    title: "Fuite inverseur BB",
    performedAt: "2026-09-04",
    status: "urgent",
    categoryId: ENGINES_CATEGORY.id,
    categoryName: ENGINES_CATEGORY.name,
    categoryColor: ENGINES_CATEGORY.color,
    contactName: "Motoriste Yanmar",
    cost: null,
    needsReview: false,
    engineHours: [],
    updatedAt: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "log-4",
    title: "Réparation lazy bag",
    performedAt: "2026-09-12",
    status: "planned",
    categoryId: SAILS_CATEGORY.id,
    categoryName: SAILS_CATEGORY.name,
    categoryColor: SAILS_CATEGORY.color,
    contactName: "Voilerie Delta",
    cost: 340,
    needsReview: false,
    engineHours: [],
    updatedAt: "2026-08-30T10:00:00.000Z",
  },
  {
    id: "log-5",
    title: "Antifouling coque bâbord",
    performedAt: "2026-08-20",
    status: "in_progress",
    categoryId: HULL_CATEGORY.id,
    categoryName: HULL_CATEGORY.name,
    categoryColor: HULL_CATEGORY.color,
    contactName: "Chantier Naval de Hyères",
    cost: 1890,
    needsReview: false,
    engineHours: [],
    updatedAt: "2026-08-20T10:00:00.000Z",
  },
  {
    id: "log-6",
    title: "Contrôle radeau de survie",
    performedAt: "2025-12-30",
    status: "done",
    categoryId: SAFETY_CATEGORY.id,
    categoryName: SAFETY_CATEGORY.name,
    categoryColor: SAFETY_CATEGORY.color,
    contactName: null,
    cost: 210,
    needsReview: true,
    engineHours: [],
    updatedAt: "2025-12-30T10:00:00.000Z",
  },
];

export const DEV_LOG_DETAIL: LogDetailData = {
  id: "log-2",
  title: "Vidange + entretien complet (2 moteurs)",
  performedAt: "2026-03-06",
  status: "done",
  categoryId: ENGINES_CATEGORY.id,
  categoryName: ENGINES_CATEGORY.name,
  categoryColor: ENGINES_CATEGORY.color,
  categoryIcon: ENGINES_CATEGORY.icon,
  categoryArchived: false,
  cost: 620,
  notes: "Huile 15W40, filtres neufs. Courroie alternateur SB retendue.",
  equipmentName: "Moteur SB · Yanmar 4JH45",
  needsReview: false,
  createdByName: "Xavier Marin",
  createdAt: "2026-03-06T18:20:00.000Z",
  updatedByName: "Emmanuel Lesaffre",
  updatedAt: "2026-03-08T09:05:00.000Z",
};

export const DEV_LOG_COMPLETIONS: LogDetailCompletion[] = [
  {
    id: "completion-1",
    label: "Vidange huile moteur + filtre à huile — Moteur SB",
    categoryId: ENGINES_CATEGORY.id,
    categoryName: ENGINES_CATEGORY.name,
    categoryColor: ENGINES_CATEGORY.color,
    engineHours: 1256,
  },
  {
    id: "completion-2",
    label: "Vidange huile moteur + filtre à huile — Moteur BB",
    categoryId: ENGINES_CATEGORY.id,
    categoryName: ENGINES_CATEGORY.name,
    categoryColor: ENGINES_CATEGORY.color,
    engineHours: 1208,
  },
];
