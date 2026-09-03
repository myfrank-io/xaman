import { normaliseHeader, type FieldDescriptor } from "@/lib/import/mapping";
import { addDays, parseDecimal, roundTo, toIsoDate } from "@/lib/numbers";

/**
 * What can be imported, and how a row of a spreadsheet becomes a row of the database (E12-3).
 *
 * A descriptor is deliberately dumb: the columns it accepts, how to read a cell, and the
 * natural key used to recognise a line already present. Everything else — parsing, mapping,
 * validation, writing — is shared by every entity.
 */
export const IMPORT_ENTITIES = [
  "logs",
  "purchases",
  "contacts",
  "equipment",
  "parts",
  "completions",
  "readings",
] as const;
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

/**
 * « Pièce », "part", « pièces détachées » — a purchase whose type we cannot read is filed as
 * « Autre » rather than refused: the amount and the date are what matter, and the type is one
 * tap to fix afterwards.
 */
export function cellPurchaseKind(
  value: string | undefined,
): "gas" | "part" | "consumable" | "service" | "other" {
  const folded = normaliseHeader(value ?? "");
  if (folded.startsWith("gaz") || folded.startsWith("gas")) return "gas";
  if (folded.startsWith("piece") || folded.startsWith("part")) return "part";
  if (folded.startsWith("consommable") || folded.startsWith("consumable")) return "consumable";
  if (folded.startsWith("prestation") || folded.startsWith("service")) return "service";
  return "other";
}

export type EntityDescriptor = {
  key: ImportEntity;
  /** Table written, used by the Server Action. */
  table:
    | "contacts"
    | "equipment"
    | "parts"
    | "maintenance_logs"
    | "purchases"
    | "checklist_completions"
    | "engine_hour_readings";
  fields: FieldDescriptor[];
  /**
   * Recognises a line already on the boat, so re-importing a corrected sheet corrects it
   * instead of duplicating it. Empty string = always a new row.
   */
  naturalKey: (row: ImportRow, match?: ImportMatcher) => string;
  /** Columns read back from the table to recognise the rows already there. */
  keyColumns: string;
  /** The same key, built from a row that is already in the database. */
  existingKey: (row: Record<string, unknown>) => string;
  /** Rows that only ever arrive through an import land « à vérifier ». */
  needsReview?: boolean;
  /** Table with a trash: a line put there on purpose must not be matched and revived. */
  softDeleted?: boolean;
  /** Reads the boat's contacts, to turn a provider's name into a link. */
  matchesContacts?: boolean;
  /**
   * What the boat has to be read before the file can be understood (E12-4): a spreadsheet
   * names a checklist point or an engine in a person's own words, never by id.
   */
  catalog?: "checklist" | "engines";
};

/** `text(value)`, but folded the way a header is, for comparing two names. */
function fold(value: unknown): string {
  return normaliseHeader(String(value ?? ""));
}

/**
 * A dated record is the same record when its wording AND its date match. « Vidange » in April
 * and « Vidange » in October are two interventions, not one corrected twice — so the date is
 * part of the key. A file that carries its own reference wins over both: that is what an
 * accounting export gives, and it survives a title being rewritten.
 */
function datedKey(reference: string | null, label: string, date: string | null): string {
  if (reference) return `ref:${fold(reference)}`;
  return `${fold(label)}@${date ?? ""}`;
}

/**
 * What the boat already carries, so a line naming a checklist point or an engine in a
 * person's own words can find it (E12-4). Read once by the Server Action and by the import
 * screen, so the count announced before the write is the count actually written.
 */
export type ImportCatalog = {
  /** Checklist points; `intervalHours` says whether the point is followed in engine hours. */
  items?: { id: string; label: string; intervalHours: number | null }[];
  /** Engines of the boat, named by their label — and by their position when it is unique. */
  engines?: { id: string; label: string; position: string }[];
  /** Readings already recorded, so a counter that goes backwards is spotted. */
  readings?: { engineId: string; readAt: string; hours: number }[];
};

/** A checklist point resolved from a name, with what the database will demand of it. */
export type ChecklistTarget = { id: string; intervalHours: number | null };

/** Two rows sharing a name cannot be told apart: the line is refused, never attached at random. */
export const AMBIGUOUS = "ambiguous" as const;
/** Objects on purpose, so the sentinel can never be mistaken for a resolved id. */
type Resolved<T extends object> = T | null | typeof AMBIGUOUS;

export type ImportMatcher = {
  /** The checklist point a name designates, `null` when the boat has none. */
  item: (label: string) => Resolved<ChecklistTarget>;
  /** The engine a name designates, `null` when the boat has none. */
  engine: (label: string) => Resolved<{ id: string }>;
  /**
   * Highest counter value known for this engine on or before `date` — the boat's readings
   * and the lines of the same file already accepted. A reading below it goes backwards.
   */
  hoursOn: (engineId: string, date: string) => number | null;
  /** Records an accepted line, so the rest of the file is compared to it too. */
  remember: (engineId: string, date: string, hours: number) => void;
};

/** French spellings of an engine position, used only while a single engine holds it. */
const POSITION_ALIASES: Record<string, string[]> = {
  port: ["babord", "bb", "port", "moteur babord"],
  starboard: ["tribord", "td", "tb", "starboard", "moteur tribord"],
  center: ["central", "centre", "center", "moteur central"],
  outboard: ["hors-bord", "horsbord", "outboard", "annexe"],
};

/**
 * What every list cuts its subject to before it reaches a natural key or a column
 * (`buildDatabaseRow`). The matcher has to cut the same way, or the preview would accept a
 * long name that the write then fails to resolve.
 */
export const IMPORT_NAME_MAX = 120;

/** `name → value`, folded like a header; a name held by two rows resolves to AMBIGUOUS. */
function nameIndex<T extends object>(rows: { name: string; value: T }[]): Map<string, Resolved<T>> {
  const index = new Map<string, Resolved<T>>();
  for (const row of rows) {
    const key = fold(row.name);
    if (key === "") continue;
    index.set(key, index.has(key) ? AMBIGUOUS : row.value);
  }
  return index;
}

export function createMatcher(catalog: ImportCatalog = {}): ImportMatcher {
  // A checklist label may run to 160 characters (`upsertChecklistItemSchema`), and the engine
  // cuts every subject to IMPORT_NAME_MAX before it reaches a key. So a long point is indexed
  // twice, under its label and under the cut the file will carry — otherwise « Vidange huile
  // moteur (filtre, joint, contrôle du niveau à froid) — Moteur bâbord » would be refused as
  // unknown for being too long, which is not a reason anyone can act on.
  const items = nameIndex(
    (catalog.items ?? []).flatMap((item) => {
      const value = { id: item.id, intervalHours: item.intervalHours };
      const cut = item.label.slice(0, IMPORT_NAME_MAX);
      const entry = { name: item.label, value };
      return cut === item.label ? [entry] : [entry, { name: cut, value }];
    }),
  );

  const engines = nameIndex(
    (catalog.engines ?? []).map((engine) => ({ name: engine.label, value: { id: engine.id } })),
  );
  // « Bâbord » finds the port engine — but only while a single engine holds that position,
  // and never over a label someone actually wrote.
  const byPosition = new Map<string, string[]>();
  for (const engine of catalog.engines ?? []) {
    byPosition.set(engine.position, [...(byPosition.get(engine.position) ?? []), engine.id]);
  }
  for (const [position, ids] of byPosition) {
    const only = ids.length === 1 ? ids[0] : undefined;
    if (only === undefined) continue;
    for (const alias of POSITION_ALIASES[position] ?? []) {
      const key = fold(alias);
      if (!engines.has(key)) engines.set(key, { id: only });
    }
  }

  // Per engine, every reading known: the floor a later line may not fall below.
  const readings = new Map<string, { readAt: string; hours: number }[]>();
  for (const reading of catalog.readings ?? []) {
    readings.set(reading.engineId, [
      ...(readings.get(reading.engineId) ?? []),
      { readAt: reading.readAt, hours: reading.hours },
    ]);
  }

  return {
    item: (label) => items.get(fold(label)) ?? null,
    engine: (label) => engines.get(fold(label)) ?? null,
    hoursOn: (engineId, date) => {
      let highest: number | null = null;
      for (const reading of readings.get(engineId) ?? []) {
        if (reading.readAt > date) continue;
        if (highest === null || reading.hours > highest) highest = reading.hours;
      }
      return highest;
    },
    remember: (engineId, date, hours) => {
      readings.set(engineId, [...(readings.get(engineId) ?? []), { readAt: date, hours }]);
    },
  };
}

/**
 * Adds an accepted line to the matcher, so the next lines of the same file are read against
 * it. Called by the preview and by the write right after `rejectionReason` returned null: a
 * sheet of 300 readings must be caught contradicting itself on line 200, not only the boat.
 */
export function rememberRow(entity: ImportEntity, row: ImportRow, match: ImportMatcher): void {
  if (entity !== "readings") return;
  const engine = match.engine(row.name ?? "");
  const date = cellDate(row.date);
  const hours = cellNumber(row.hours);
  if (engine === null || engine === AMBIGUOUS || date === null || hours === null) return;
  match.remember(engine.id, date, roundTo(hours, 1));
}

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
  logs: {
    key: "logs",
    table: "maintenance_logs",
    softDeleted: true,
    matchesContacts: true,
    // Imported history is never taken on trust: it lands « à vérifier », where the dates,
    // the systems and the providers get confirmed one screen at a time.
    needsReview: true,
    keyColumns: "id, title, performed_at, external_ref",
    existingKey: (row) =>
      datedKey(
        typeof row.external_ref === "string" ? row.external_ref : null,
        String(row.title ?? ""),
        typeof row.performed_at === "string" ? row.performed_at : null,
      ),
    naturalKey: (row) => datedKey(cellText(row.reference, 120), row.name ?? "", cellDate(row.date)),
    fields: [
      {
        key: "name",
        label: "Intervention",
        required: true,
        aliases: ["titre", "libelle", "libellé", "designation", "désignation", "travaux", "objet"],
        sample: "Vidange moteur bâbord",
      },
      {
        key: "date",
        label: "Faite le",
        required: true,
        aliases: ["date", "date intervention", "realisee le", "réalisée le", "jour"],
        sample: "14/06/2026",
      },
      CATEGORY,
      {
        key: "provider",
        label: "Prestataire",
        aliases: ["intervenant", "entreprise", "chantier", "fournisseur", "par"],
        help: "Le nom d'un contact du bateau. Inconnu, il est recopié dans les notes.",
        sample: "Motoriste Yanmar",
      },
      {
        key: "cost",
        label: "Coût",
        aliases: ["montant", "prix", "facture", "total", "ttc"],
        sample: "348,50",
      },
      {
        key: "reference",
        label: "Référence",
        aliases: ["ref", "réf", "numero", "numéro", "no facture", "n° facture"],
        help: "Si votre fichier en porte une, elle sert à reconnaître la ligne d'un import à l'autre.",
        sample: "F-2026-0142",
      },
      { ...NOTES, sample: "Filtres et joints changés, huile 15W40." },
    ],
  },
  purchases: {
    key: "purchases",
    table: "purchases",
    softDeleted: true,
    matchesContacts: true,
    needsReview: true,
    keyColumns: "id, designation, purchased_at, external_ref",
    existingKey: (row) =>
      datedKey(
        typeof row.external_ref === "string" ? row.external_ref : null,
        String(row.designation ?? ""),
        typeof row.purchased_at === "string" ? row.purchased_at : null,
      ),
    naturalKey: (row) => datedKey(cellText(row.reference, 120), row.name ?? "", cellDate(row.date)),
    fields: [
      {
        key: "name",
        label: "Achat",
        required: true,
        aliases: ["designation", "désignation", "libelle", "libellé", "article", "objet"],
        sample: "Filtre à huile Volvo",
      },
      {
        key: "date",
        label: "Acheté le",
        required: true,
        aliases: ["date", "date achat", "date facture", "jour"],
        sample: "02/06/2026",
      },
      {
        key: "amount",
        label: "Montant",
        required: true,
        aliases: ["prix", "cout", "coût", "total", "ttc", "somme"],
        sample: "42,90",
      },
      {
        key: "kind",
        label: "Type",
        aliases: ["nature", "categorie achat", "type achat"],
        help: "Gaz, Pièce, Consommable, Prestation ou Autre. Vide, l'achat est classé « Autre ».",
        allowDefault: true,
        sample: "Pièce",
      },
      { key: "quantity", label: "Quantité", aliases: ["qte", "qté", "nombre"], sample: "2" },
      {
        key: "supplier",
        label: "Fournisseur",
        aliases: ["vendeur", "magasin", "chantier", "entreprise", "chez"],
        allowDefault: true,
        sample: "Accastillage Diffusion",
      },
      CATEGORY,
      {
        key: "reference",
        label: "Référence",
        aliases: ["ref", "réf", "numero", "numéro", "no facture", "n° facture"],
        help: "Si votre fichier en porte une, elle sert à reconnaître la ligne d'un import à l'autre.",
        sample: "AD-88213",
      },
      { ...NOTES, sample: "Deux filtres d'avance au coffre bâbord." },
    ],
  },
  contacts: {
    key: "contacts",
    table: "contacts",
    // D41: same rule as the stock — a provider put in the trash stays there.
    softDeleted: true,
    keyColumns: "id, name",
    existingKey: (row) => fold(row.name),
    naturalKey: (row) => fold(row.name),
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
    keyColumns: "id, name",
    existingKey: (row) => fold(row.name),
    naturalKey: (row) => fold(row.name),
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
    // D40: the stock has a trash now, so a line someone removed is not « already there ».
    softDeleted: true,
    keyColumns: "id, name",
    existingKey: (row) => fold(row.name),
    naturalKey: (row) => fold(row.name),
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
  /**
   * Points de checklist déjà faits (E12-4). A completion is the same event when it names the
   * same point on the same day, so the key is the *resolved* point id and the date — never
   * the wording, which two lines of the same file spell two ways.
   */
  completions: {
    key: "completions",
    table: "checklist_completions",
    catalog: "checklist",
    keyColumns: "id, checklist_item_id, completed_at",
    existingKey: (row) =>
      datedKey(null, String(row.checklist_item_id ?? ""), asDate(row.completed_at)),
    naturalKey: (row, match) => {
      const item = match?.item(row.name ?? "");
      if (!item || item === AMBIGUOUS) return "";
      return datedKey(null, item.id, cellDate(row.date));
    },
    fields: [
      {
        key: "name",
        label: "Point de checklist",
        required: true,
        aliases: [
          "point",
          "controle",
          "contrôle",
          "intitule",
          "intitulé",
          "libelle",
          "libellé",
          "tache",
          "tâche",
          "operation",
          "opération",
        ],
        help: "Le nom d'un point de la checklist du bateau, aux accents et à la casse près. Un nom inconnu est refusé, jamais rattaché au hasard.",
        // « Tout ce tableau, c'est la vidange » : un point, beaucoup de dates.
        allowDefault: true,
        sample: "Vidange huile moteur — Bâbord",
      },
      {
        key: "date",
        label: "Fait le",
        required: true,
        aliases: ["date", "date realisation", "réalisé le", "realise le", "jour"],
        sample: "14/06/2026",
      },
      {
        key: "hours",
        label: "Heures moteur",
        aliases: ["heures", "compteur", "h moteur", "heures moteur", "horametre", "horamètre"],
        help: "Obligatoire pour un point suivi en heures ; elle devient aussi un relevé du compteur.",
        sample: "1250",
      },
      {
        key: "by",
        label: "Fait par",
        aliases: ["par", "realise par", "réalisé par", "intervenant", "operateur", "opérateur"],
        help: "Recopié tel quel : l'import ne devine pas quel compte de l'équipage il désigne.",
        allowDefault: true,
        sample: "Xavier",
      },
      {
        key: "nextDate",
        label: "Valide jusqu'au",
        aliases: [
          "valide jusqu au",
          "echeance",
          "échéance",
          "expire le",
          "peremption",
          "péremption",
        ],
        help: "Date imprimée sur l'objet (radeau, fusées, extincteurs) ; elle l'emporte sur l'intervalle.",
        sample: "14/06/2029",
      },
      { ...NOTES, key: "note", sample: "Huile 15W40, filtre neuf." },
    ],
  },
  /**
   * Relevés d'heures (E12-4). One counter value per engine and per day: two lines of the same
   * day are one reading corrected, and a re-import corrects instead of piling up.
   */
  readings: {
    key: "readings",
    table: "engine_hour_readings",
    catalog: "engines",
    keyColumns: "id, engine_id, read_at, maintenance_log_id, checklist_completion_id",
    // A reading derived from an intervention or from a completion belongs to it (D5): the
    // trash parks and rebuilds it. An import must never take it over — it stays unmatched.
    existingKey: (row) =>
      row.maintenance_log_id || row.checklist_completion_id
        ? ""
        : datedKey(null, String(row.engine_id ?? ""), asDate(row.read_at)),
    naturalKey: (row, match) => {
      const engine = match?.engine(row.name ?? "");
      if (!engine || engine === AMBIGUOUS) return "";
      return datedKey(null, engine.id, cellDate(row.date));
    },
    fields: [
      {
        key: "name",
        label: "Moteur",
        required: true,
        aliases: ["engine", "moteur", "nom du moteur"],
        help: "Le nom d'un moteur du bateau ; « bâbord » et « tribord » sont compris.",
        // A logbook of one engine names it in its title, not on every line.
        allowDefault: true,
        sample: "Moteur bâbord",
      },
      {
        key: "date",
        label: "Relevé le",
        required: true,
        aliases: ["date", "date releve", "date relevé", "jour"],
        sample: "14/06/2026",
      },
      {
        key: "hours",
        label: "Heures",
        required: true,
        aliases: ["compteur", "heures moteur", "h", "horametre", "horamètre", "index"],
        sample: "1250,5",
      },
      { ...NOTES, key: "note", sample: "Relevé au départ de Lorient." },
    ],
  },
};

/** A `date` column of Postgres comes back as a string through PostgREST, as a Date through pg. */
function asDate(value: unknown): string | null {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return toIsoDate(value);
  return null;
}

export function descriptorOf(entity: ImportEntity): EntityDescriptor {
  return ENTITY_DESCRIPTORS[entity];
}

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/**
 * Why this row cannot be written, or `null` when it can. Shared by the preview and by the
 * Server Action so the screen can announce « 2 refusées » before the write and name the same
 * reason afterwards — a count that changes between the two would be worse than no count.
 */
export function rejectionReason(
  entity: ImportEntity,
  row: ImportRow,
  /** Required by the two lists matched by name (E12-4); ignored by the others. */
  match?: ImportMatcher,
): string | null {
  if (entity === "completions") return completionReason(row, match);
  if (entity === "readings") return readingReason(row, match);
  if (!cellText(row.name, IMPORT_NAME_MAX)) return "import.errors.noName";
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
  if (entity === "logs" || entity === "purchases") {
    // Undated, a line cannot take its place in the boat's history — that is the whole point.
    if ((row.date ?? "").trim() === "") return "import.errors.noDate";
    if (cellDate(row.date) === null) return "import.errors.badDate";
    const money = entity === "logs" ? row.cost : row.amount;
    if (entity === "purchases" && (money ?? "").trim() === "") return "import.errors.noAmount";
    if ((money ?? "").trim() !== "" && cellNumber(money) === null) {
      return "import.errors.badAmount";
    }
  }
  return null;
}

/** `numeric(8,1)` would take more, but a counter that reads 100 000 h is a typo (D: engines). */
export const IMPORT_HOURS_MAX = 99_999.9;

/** A completion and a reading are refused in the future: the database refuses them too (D17). */
function futureDate(date: string): boolean {
  return date > addDays(toIsoDate(), 1);
}

/**
 * A completed checklist point (E12-4). The point is found by its name; a name the boat does
 * not carry — or carries twice — is refused and listed, never attached to a neighbour. Engine
 * hours are demanded exactly where the database demands them: on a point followed in hours
 * (`check_completion_hours` would otherwise raise `engine_hours_required` and take
 * the whole batch down with it).
 */
function completionReason(row: ImportRow, match?: ImportMatcher): string | null {
  const label = cellText(row.name, IMPORT_NAME_MAX);
  if (!label) return "import.errors.noItem";
  const item = match?.item(label) ?? null;
  if (item === AMBIGUOUS) return "import.errors.ambiguousItem";
  if (!item) return "import.errors.unknownItem";

  if ((row.date ?? "").trim() === "") return "import.errors.noDate";
  const date = cellDate(row.date);
  if (date === null) return "import.errors.badDate";
  if (futureDate(date)) return "import.errors.futureDate";

  const hours = (row.hours ?? "").trim();
  if (hours === "" && item.intervalHours !== null) return "import.errors.noEngineHours";
  if (hours !== "") {
    const value = cellNumber(hours);
    if (value === null || value < 0 || value > IMPORT_HOURS_MAX) return "import.errors.badHours";
  }

  const next = (row.nextDate ?? "").trim();
  if (next !== "") {
    const nextDate = cellDate(next);
    if (nextDate === null) return "import.errors.badDate";
    // `checklist_completions_next_due_after_completed` (0004) rejects the rest.
    if (nextDate <= date) return "import.errors.badDueDate";
  }
  return null;
}

/**
 * An engine hour reading (E12-4). The counter only goes up: a value below what the boat — or
 * an earlier line of the same file — already knows for that engine on or before that day is
 * refused rather than written. A counter really replaced is declared on the engine's own
 * screen (D12), where it stamps `counter_reset_at`; a spreadsheet cannot decide that.
 */
function readingReason(row: ImportRow, match?: ImportMatcher): string | null {
  const label = cellText(row.name, IMPORT_NAME_MAX);
  if (!label) return "import.errors.noEngine";
  const engine = match?.engine(label) ?? null;
  if (engine === AMBIGUOUS) return "import.errors.ambiguousEngine";
  if (!engine) return "import.errors.unknownEngine";

  if ((row.date ?? "").trim() === "") return "import.errors.noDate";
  const date = cellDate(row.date);
  if (date === null) return "import.errors.badDate";
  if (futureDate(date)) return "import.errors.futureDate";

  if ((row.hours ?? "").trim() === "") return "import.errors.noHours";
  const hours = cellNumber(row.hours);
  if (hours === null || hours < 0 || hours > IMPORT_HOURS_MAX) return "import.errors.badHours";

  const known = match?.hoursOn(engine.id, date) ?? null;
  if (known !== null && roundTo(hours, 1) < known) return "import.errors.hoursBackwards";
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

/**
 * What the Server Action needs from the boat to turn a mapped row into a database row.
 * Passed in rather than looked up here, so this stays a pure function and can be tested
 * against the real schema without a session.
 */
export type RowContext = {
  id: string;
  boatId: string;
  userId: string | null;
  /** A creation carries `created_by`; an update must not overwrite it. */
  isNew: boolean;
  categoryId: string | null;
  /** A provider's name → the id of a contact of the boat, or null. */
  contactId: (name: string) => string | null;
  /**
   * Resolves the checklist point or the engine a line names (E12-4). `rejectionReason` has
   * already refused the lines that resolve to nothing, so here it always finds one.
   */
  match?: ImportMatcher;
};

/**
 * A mapped row becomes the object written to `descriptor.table`.
 *
 * Pure and exported on purpose: `tests/unit/import-write.test.ts` writes what this returns
 * into the real schema. That is how the « Prochaine échéance » column was caught — it had
 * been removed from `maintenance_logs` by migration 0004, and nothing but a real insert
 * could have told us.
 */
export function buildDatabaseRow(
  entity: ImportEntity,
  row: ImportRow,
  context: RowContext,
): Record<string, unknown> {
  const name = cellText(row.name, IMPORT_NAME_MAX) ?? "";
  const notes = cellText(row.notes, 2000);
  // Each table names its subject differently: `name`, `title`, `designation` — and its free
  // text `notes` or `note`, so the column is named by the branch, never by this base.
  const base = {
    id: context.id,
    boat_id: context.boatId,
    updated_by: context.userId,
    ...(context.isNew ? { created_by: context.userId } : {}),
    ...(ENTITY_DESCRIPTORS[entity].needsReview ? { needs_review: true } : {}),
  };

  if (entity === "completions") {
    const item = context.match?.item(name);
    const hours = cellNumber(row.hours);
    return {
      ...base,
      checklist_item_id: item && item !== AMBIGUOUS ? item.id : null,
      completed_at: cellDate(row.date),
      // The person who did the work is copied as written: guessing which account of the crew
      // a paper logbook meant would put a name on someone who was not there.
      completed_by: null,
      completed_by_name: cellText(row.by, 120),
      engine_hours: hours === null ? null : roundTo(Math.max(0, hours), 1),
      next_due_at: cellDate(row.nextDate),
      note: cellText(row.note, 2000),
    };
  }

  if (entity === "readings") {
    const engine = context.match?.engine(name);
    const hours = cellNumber(row.hours) ?? 0;
    return {
      ...base,
      engine_id: engine && engine !== AMBIGUOUS ? engine.id : null,
      hours: roundTo(Math.max(0, hours), 1),
      read_at: cellDate(row.date),
      // The enum has carried an `import` value since 0001: a counter typed by hand and one
      // read off a spreadsheet are not the same claim.
      source: "import",
      note: cellText(row.note, 500),
    };
  }

  if (entity === "contacts") {
    return {
      ...base,
      name,
      notes,
      specialty: cellText(row.specialty, 60),
      company: cellText(row.company, 120),
      phone: cellText(row.phone, 40),
      email: cellText(row.email, 160),
      address: cellText(row.address, 300),
    };
  }

  if (entity === "equipment") {
    const quantity = cellNumber(row.quantity);
    return {
      ...base,
      name,
      notes,
      category_id: context.categoryId,
      brand: cellText(row.brand, 80),
      model: cellText(row.model, 80),
      serial: cellText(row.serial, 80),
      quantity: quantity === null ? 1 : Math.max(0, Math.round(quantity)),
      installed_at: cellDate(row.installedAt),
    };
  }

  if (entity === "parts") {
    const quantity = cellNumber(row.quantity);
    const minQuantity = cellNumber(row.minQuantity);
    return {
      ...base,
      name,
      notes,
      reference: cellText(row.reference, 80),
      quantity: quantity === null ? 0 : Math.max(0, quantity),
      min_quantity: minQuantity === null ? 0 : Math.max(0, minQuantity),
      unit: cellText(row.unit, 12) ?? "pc",
      location: cellText(row.location, 80),
      category_id: context.categoryId,
    };
  }

  if (entity === "logs") {
    // A provider that matches a contact of the boat is linked; one that matches nothing is
    // copied into the notes rather than dropped, and the line is « à vérifier » anyway.
    const provider = cellText(row.provider, 120);
    const contactId = provider ? context.contactId(provider) : null;
    const unmatched = provider && !contactId ? `Prestataire : ${provider}` : null;
    return {
      ...base,
      title: name,
      notes: [notes, unmatched].filter(Boolean).join("\n") || null,
      performed_at: cellDate(row.date),
      category_id: context.categoryId,
      contact_id: contactId,
      cost: cellNumber(row.cost),
      external_ref: cellText(row.reference, 120),
      status: "done",
    };
  }

  const quantity = cellNumber(row.quantity);
  const supplier = cellText(row.supplier, 120);
  return {
    ...base,
    designation: name,
    notes,
    purchased_at: cellDate(row.date),
    amount: cellNumber(row.amount),
    kind: cellPurchaseKind(row.kind),
    quantity: quantity === null || quantity <= 0 ? 1 : quantity,
    supplier_name: supplier,
    supplier_contact_id: supplier ? context.contactId(supplier) : null,
    category_id: context.categoryId,
    external_ref: cellText(row.reference, 120),
  };
}
