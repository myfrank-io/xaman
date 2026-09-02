import type { ContactOption } from "@/components/contacts/specialties";
import type { GasDefaults } from "@/components/supplies/GasBottleDialog";
import type { ExpensesData } from "@/components/supplies/ExpensesTab";
import type { PurchaseListItem } from "@/components/supplies/PurchaseList";
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

export const SAMPLE_EXPENSES: ExpensesData = {
  rows: EXPENSE_ROWS,
  previousTotal: 2617,
  cumulativeTotal: 12480.6,
  firstDate: "2023-06-14",
};

export const SAMPLE_PURCHASES: PurchaseListItem[] = [
  {
    id: "p1",
    purchasedAt: "2026-08-20",
    designation: "Filtres à huile Yanmar",
    kind: "part",
    amount: 148.4,
    categoryName: ENGINES.name,
    categoryColor: ENGINES.color,
    supplier: "Accastillage Diffusion",
    needsReview: false,
  },
  {
    id: "p2",
    purchasedAt: "2026-07-05",
    designation: "Bouteille de gaz — Butane 13 kg",
    kind: "gas",
    amount: 34.5,
    categoryName: PLUMBING.name,
    categoryColor: PLUMBING.color,
    supplier: "Hyères",
    needsReview: true,
  },
  {
    id: "p3",
    purchasedAt: "2026-03-11",
    designation: "Bouteille de gaz — Butane 13 kg",
    kind: "gas",
    amount: 33.9,
    categoryName: PLUMBING.name,
    categoryColor: PLUMBING.color,
    supplier: "Hyères",
    needsReview: false,
  },
  {
    id: "p4",
    purchasedAt: "2026-03-02",
    designation: "Anodes de rechange",
    kind: "consumable",
    amount: 96,
    categoryName: HULL.name,
    categoryColor: HULL.color,
    supplier: null,
    needsReview: false,
  },
  {
    id: "p5",
    purchasedAt: "2025-11-30",
    designation: "Changement bouteille gaz",
    kind: "gas",
    amount: null,
    categoryName: PLUMBING.name,
    categoryColor: PLUMBING.color,
    supplier: null,
    needsReview: true,
  },
];

export const SAMPLE_GAS_PURCHASES = SAMPLE_PURCHASES.filter((purchase) => purchase.kind === "gas");

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
