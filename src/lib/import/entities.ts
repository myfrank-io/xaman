import { normaliseHeader, type FieldDescriptor } from "@/lib/import/mapping";
import { parseDecimal } from "@/lib/numbers";

/**
 * What can be imported, and how a row of a spreadsheet becomes a row of the database (E12-3).
 *
 * A descriptor is deliberately dumb: the columns it accepts, how to read a cell, and the
 * natural key used to recognise a line already present. Everything else — parsing, mapping,
 * validation, writing — is shared by every entity.
 */
export const IMPORT_ENTITIES = ["contacts", "equipment", "parts"] as const;
export type ImportEntity = (typeof IMPORT_ENTITIES)[number];

export function isImportEntity(value: string | null | undefined): value is ImportEntity {
  return (IMPORT_ENTITIES as readonly string[]).includes(value ?? "");
}

export type ImportRow = Record<string, string>;

/** A cell that is empty, "-" or "n/a" is « nothing », not a value to store. */
export function cellText(value: string | undefined, max: number): string | null {
  const text = (value ?? "").trim();
  if (text === "" || text === "-" || /^n\/?a$/i.test(text)) return null;
  return text.slice(0, max);
}

/** « 1 256,5 », "1256.5", "12" — the French comma and thin spaces included. */
export function cellNumber(value: string | undefined): number | null {
  const parsed = parseDecimal((value ?? "").trim());
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

/** Accepts 12/03/2026, 12-03-2026 and 2026-03-12; anything else is rejected as a date. */
export function cellDate(value: string | undefined): string | null {
  const text = (value ?? "").trim();
  if (text === "") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return isRealDate(iso[1], iso[2], iso[3]) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (!fr) return null;
  const day = (fr[1] ?? "").padStart(2, "0");
  const month = (fr[2] ?? "").padStart(2, "0");
  const rawYear = fr[3] ?? "";
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return isRealDate(year, month, day) ? `${year}-${month}-${day}` : null;
}

function isRealDate(year?: string, month?: string, day?: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export type EntityDescriptor = {
  key: ImportEntity;
  /** Table written, used by the Server Action. */
  table: "contacts" | "equipment" | "parts";
  fields: FieldDescriptor[];
  /**
   * Recognises a line already on the boat, so re-importing a corrected sheet corrects it
   * instead of duplicating it. Empty string = always a new row.
   */
  naturalKey: (row: ImportRow) => string;
  /** Columns of the natural key, read from the database to match existing rows. */
  matchColumn: "name";
};

const NOTES: FieldDescriptor = {
  key: "notes",
  label: "Notes",
  aliases: ["commentaire", "commentaires", "remarque", "remarques"],
};
const CATEGORY: FieldDescriptor = {
  key: "category",
  label: "Catégorie",
  aliases: ["systeme", "système", "poste"],
  help: "Le nom d'un système du bateau ; laissé vide si aucun ne correspond.",
  // A spreadsheet of one system rarely repeats it on every line: « tout ceci, c'est Moteurs ».
  allowDefault: true,
};

export const ENTITY_DESCRIPTORS: Record<ImportEntity, EntityDescriptor> = {
  contacts: {
    key: "contacts",
    table: "contacts",
    matchColumn: "name",
    naturalKey: (row) => normaliseHeader(row.name ?? ""),
    fields: [
      {
        key: "name",
        label: "Nom",
        required: true,
        aliases: ["intitule", "contact", "raison sociale"],
        sample: "Chantier Naval du Guip",
      },
      {
        key: "specialty",
        label: "Spécialité",
        required: true,
        aliases: ["metier", "métier", "type", "categorie"],
        help: "Chantier, Voilier, Motoriste… texte libre.",
        // A contact card exported from a phone carries no trade: it is typed once, for all.
        allowDefault: true,
        sample: "Chantier",
      },
      {
        key: "company",
        label: "Société",
        aliases: ["entreprise", "societe"],
        sample: "Le Guip",
      },
      {
        key: "phone",
        label: "Téléphone",
        aliases: ["tel", "tél", "mobile", "portable"],
        sample: "02 98 00 00 00",
      },
      {
        key: "email",
        label: "E-mail",
        aliases: ["mail", "courriel", "adresse mail"],
        sample: "contact@leguip.fr",
      },
      {
        key: "address",
        label: "Adresse",
        aliases: ["adresse postale", "ville"],
        sample: "Brest",
      },
      { ...NOTES, sample: "Interlocuteur : Yann" },
    ],
  },
  equipment: {
    key: "equipment",
    table: "equipment",
    matchColumn: "name",
    naturalKey: (row) => normaliseHeader(row.name ?? ""),
    fields: [
      {
        key: "name",
        label: "Nom",
        required: true,
        aliases: ["designation", "désignation", "equipement", "équipement"],
        sample: "Guindeau",
      },
      { ...CATEGORY, sample: "Coque & Pont" },
      {
        key: "brand",
        label: "Marque",
        aliases: ["fabricant", "constructeur"],
        sample: "Lofrans",
      },
      { key: "model", label: "Modèle", aliases: ["modele", "type"], sample: "Tigres 1500 W" },
      {
        key: "serial",
        label: "Numéro de série",
        aliases: ["serie", "série", "sn", "numero de serie"],
        sample: "LT-2019-4471",
      },
      { key: "quantity", label: "Quantité", aliases: ["qte", "qté", "nombre"], sample: "1" },
      {
        key: "installedAt",
        label: "Installé le",
        aliases: ["date installation", "installation", "date"],
        sample: "12/03/2019",
      },
      { ...NOTES, sample: "Révisé au carénage 2025" },
    ],
  },
  parts: {
    key: "parts",
    table: "parts",
    matchColumn: "name",
    naturalKey: (row) => normaliseHeader(row.name ?? ""),
    fields: [
      {
        key: "name",
        label: "Désignation",
        required: true,
        aliases: ["nom", "piece", "pièce", "article"],
        sample: "Filtre à huile Volvo",
      },
      {
        key: "reference",
        label: "Référence",
        aliases: ["ref", "réf", "reference fabricant"],
        sample: "3847643",
      },
      {
        key: "quantity",
        label: "Quantité",
        aliases: ["qte", "qté", "stock", "en stock"],
        sample: "2",
      },
      {
        key: "minQuantity",
        label: "Seuil d'alerte",
        aliases: ["seuil", "minimum", "mini", "stock mini"],
        sample: "1",
      },
      // A stock sheet counts « 2 » and « 1 » without ever writing the unit down.
      { key: "unit", label: "Unité", aliases: ["unite", "u"], allowDefault: true, sample: "pc" },
      {
        key: "location",
        label: "Emplacement",
        aliases: ["rangement", "localisation", "coffre"],
        sample: "Coffre bâbord",
      },
      { ...CATEGORY, sample: "Moteurs" },
      { ...NOTES, sample: "Compatible D2-75" },
    ],
  },
};

export function descriptorOf(entity: ImportEntity): EntityDescriptor {
  return ENTITY_DESCRIPTORS[entity];
}

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/**
 * Why this row cannot be written, or `null` when it can. Shared by the preview and by the
 * Server Action so the screen can announce « 2 refusées » before the write and name the same
 * reason afterwards — a count that changes between the two would be worse than no count.
 */
export function rejectionReason(entity: ImportEntity, row: ImportRow): string | null {
  if (!cellText(row.name, 120)) return "import.errors.noName";
  if (entity === "contacts") {
    if (!cellText(row.specialty, 60)) return "import.errors.noSpecialty";
    const email = cellText(row.email, 160);
    if (email && !EMAIL.test(email)) return "import.errors.badEmail";
  }
  if (entity === "equipment") {
    if ((row.installedAt ?? "").trim() !== "" && cellDate(row.installedAt) === null) {
      return "import.errors.badDate";
    }
  }
  return null;
}

/** Enough for a boat's whole directory or stock in one go, small enough for one statement. */
export const IMPORT_MAX_ROWS = 500;

export type RejectedRow = {
  /** 1-based line of the file, header excluded — what the person sees in Excel. */
  line: number;
  reason: string;
  values: ImportRow;
};

export type ImportReport = {
  created: number;
  updated: number;
  rejected: RejectedRow[];
};
