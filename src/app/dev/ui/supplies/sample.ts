import type { StockItem } from "@/components/parts/StockList";
import type { ContactOption } from "@/components/contacts/specialties";
import type { GasDefaults } from "@/components/supplies/GasBottleDialog";
import type { ExpensesData } from "@/components/supplies/ExpensesTab";
import type { ExpenseLine } from "@/components/supplies/ExpenseLines";
import type { LogOption } from "@/components/supplies/PurchaseForm";
import type { ExpenseRow } from "@/lib/expenses";

import { SAMPLE_CATEGORIES } from "../sample-data";

// Fake data for the visual gallery: no seed, no database (E5-1 → E5-3 acceptance).
const [ENGINES, DAGGERBOARDS, SAILS, HULL, , , PLUMBING] = SAMPLE_CATEGORIES;

export const SAMPLE_SUPPLY_CATEGORIES = SAMPLE_CATEGORIES.map((category) => ({
  id: category.id,
  name: category.name,
  color: category.color,
  icon: category.icon,
}));

function row(
  category: (typeof SAMPLE_CATEGORIES)[number] | null,
  over: Pick<ExpenseRow, "source" | "entityId" | "label" | "amount" | "date">,
): ExpenseRow {
  return {
    ...over,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    categoryColor: category?.color ?? null,
  };
}

const EXPENSE_ROWS: ExpenseRow[] = [
  row(ENGINES, {
    source: "log",
    entityId: "l1",
    label: "Vidange moteur SB",
    amount: 320,
    date: "2026-08-28",
  }),
  row(ENGINES, {
    source: "purchase",
    entityId: "p1",
    label: "Filtres à huile Yanmar",
    amount: 148.4,
    date: "2026-08-20",
  }),
  row(HULL, {
    source: "haul_out",
    entityId: "h1",
    label: "Chantier Naval de Hyères",
    amount: 1850,
    date: "2026-03-02",
  }),
  row(HULL, {
    source: "log",
    entityId: "l2",
    label: "Polissage Copper Coat",
    amount: 450,
    date: "2026-03-08",
  }),
  row(SAILS, {
    source: "log",
    entityId: "l3",
    label: "Révision grand-voile",
    amount: 620,
    date: "2026-01-16",
  }),
  row(DAGGERBOARDS, {
    source: "log",
    entityId: "l4",
    label: "Contrôle des safrans",
    amount: 210,
    date: "2025-11-04",
  }),
  row(PLUMBING, {
    source: "purchase",
    entityId: "p2",
    label: "Bouteille de gaz — Butane 13 kg",
    amount: 34.5,
    date: "2026-07-05",
  }),
  row(PLUMBING, {
    source: "purchase",
    entityId: "p3",
    label: "Bouteille de gaz — Butane 13 kg",
    amount: 33.9,
    date: "2026-03-11",
  }),
];

/** The merged ledger (D33): every line says what it paid for. */
const KIND_LABELS: Record<string, string> = { p1: "Pièce", p2: "Gaz", p3: "Gaz" };
const SUPPLIERS: Record<string, string> = {
  p1: "Accastillage Diffusion",
  p2: "Station Total Hyères",
  p3: "Station Total Hyères",
};

const EXPENSE_LINES: ExpenseLine[] = EXPENSE_ROWS.map((row) => ({
  source: (row.source ?? "purchase") as ExpenseLine["source"],
  entityId: row.entityId ?? "",
  label: row.label ?? "",
  date: row.date ?? "",
  amount: row.amount,
  categoryName: row.categoryName,
  categoryColor: row.categoryColor,
  kindLabel: KIND_LABELS[row.entityId ?? ""] ?? null,
  supplier: SUPPLIERS[row.entityId ?? ""] ?? null,
  needsReview: row.entityId === "p3",
}));

export const SAMPLE_EXPENSES: ExpensesData = {
  rows: EXPENSE_ROWS,
  lines: EXPENSE_LINES,
  previousTotal: 2617,
  cumulativeTotal: 12480.6,
  firstDate: "2023-06-14",
  moreHref: null,
};

export const SAMPLE_GAS_PURCHASES = EXPENSE_LINES.filter((line) => line.kindLabel === "Gaz");

/** Four changes → three intervals: exactly the threshold where an estimate appears. */
export const SAMPLE_GAS_DATES = ["2025-03-18", "2025-07-24", "2025-11-30", "2026-07-05"];

export const SAMPLE_CONTACTS: ContactOption[] = [
  { id: "c1", name: "Chantier Naval de Hyères", specialty: "Chantier", phone: "04 94 00 00 00" },
  {
    id: "c2",
    name: "Accastillage Diffusion",
    specialty: "Shipchandler",
    company: "AD Hyères",
    phone: "04 94 00 00 01",
  },
  { id: "c3", name: "Paul Martin", specialty: "Motoriste", company: "Yanmar Service", phone: null },
];

export const SAMPLE_GAS_DEFAULTS: GasDefaults = {
  bottleTypes: ["Butane 13 kg", "Campingaz 907", "Propane 13 kg"],
  bottleType: "Butane 13 kg",
  supplierContactId: null,
  supplierName: "Hyères",
  categoryId: PLUMBING.id,
};

export const SAMPLE_LOGS: LogOption[] = [
  { id: "l1", title: "Vidange moteur SB", performedAt: "2026-08-28" },
  { id: "l2", title: "Polissage Copper Coat", performedAt: "2026-03-08" },
  { id: "l3", title: "Révision grand-voile", performedAt: "2026-01-16" },
];

export const SAMPLE_DESIGNATIONS = [
  "Bouteille de gaz — Butane 13 kg",
  "Filtres à huile Yanmar",
  "Anodes de rechange",
  "Huile moteur 15W40",
];

/** Stock tab (E5-4): two lines under the threshold, one never counted, one without threshold. */
export const SAMPLE_PARTS: StockItem[] = [
  {
    id: "part-1",
    name: "Filtre à huile Yanmar",
    reference: "119305-35170",
    quantity: 1,
    minQuantity: 2,
    unit: "pc",
    location: "Coffre moteur BB",
    categoryName: "Moteurs",
    categoryColor: "#D97706",
    supplierName: "Motoriste Yanmar",
    checkedAt: "2026-03-06",
  },
  {
    id: "part-2",
    name: "Turbine pompe eau de mer",
    reference: "129470-42530",
    quantity: 2,
    minQuantity: 1,
    unit: "pc",
    location: "Coffre moteur SB",
    categoryName: "Moteurs",
    categoryColor: "#D97706",
    supplierName: null,
    checkedAt: "2026-08-20",
  },
  {
    id: "part-3",
    name: "Anodes d'embase",
    reference: null,
    quantity: 0,
    minQuantity: 2,
    unit: "jeu",
    location: "Cabine avant BB",
    categoryName: "Coque & Pont",
    categoryColor: "#52606F",
    supplierName: null,
    checkedAt: null,
  },
  {
    id: "part-4",
    name: "Manilles inox 8 mm",
    reference: null,
    quantity: 6,
    minQuantity: 0,
    unit: "pc",
    location: "Boîte accastillage",
    categoryName: "Voiles & Gréement",
    categoryColor: "#A21CAF",
    supplierName: null,
    checkedAt: "2025-11-02",
  },
  {
    id: "part-5",
    name: "Cordage 8 mm",
    reference: null,
    quantity: 25,
    minQuantity: 10,
    unit: "m",
    location: "Coffre cockpit",
    categoryName: null,
    categoryColor: null,
    supplierName: null,
    checkedAt: "2026-07-15",
  },
];
