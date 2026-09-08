import { normaliseSuggestion, type InboxContext, type InboxModelOutput } from "@/lib/inbox/prompt";
import {
  INBOX_WARNING_CODES,
  type InboxSuggestion,
  type InboxWarningCode,
} from "@/lib/schemas/inbox";
import type { VisiblePurchaseKind } from "@/lib/schemas/purchases";

/**
 * The local reading of a document (D92): no model, no key, no cost — the text of the document
 * (a PDF's own text layer, or what the OCR read on a photo) and a handful of rules a person
 * filing invoices would apply by hand.
 *
 * What it looks for, in order: what kind of paper it is (facture, devis, ticket…), a date that is
 * labelled as the document's date and is not in the future, the total including tax (« Total
 * TTC », « Net à payer »), the supplier — one of the boat's contacts when its name is on the
 * page, else the header line —, the system the work belongs to (a vocabulary per family), the
 * lines that end with an amount, and hour-meter readings. Whatever is not found is null, and
 * says so in `warnings` as a code the screen translates (`inbox.warningCodes`). The output goes
 * through `normaliseSuggestion` like the model's, so the row never holds an id the boat does not
 * have.
 *
 * It is deliberately literal: a guess it cannot justify is a null the person fills in one tap,
 * where a wrong figure is a wrong line in the carnet.
 */
export type HeuristicInput = {
  text: string;
  fileName: string;
  /** The mail subject, when the document came by mail. */
  subject?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  /** Mean OCR confidence 0–100 on a photo; null for a PDF text layer. */
  ocrConfidence?: number | null;
};

/** Codes the screen translates; anything else in `warnings` is shown as it is. */
export const HEURISTIC_WARNING_CODES = INBOX_WARNING_CODES;
export type HeuristicWarningCode = InboxWarningCode;

// ---------------------------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------------------------

/** Lower-case, accents dropped, spaces normalised: the shape every keyword below is written in. */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0153/g, "oe")
    .replace(/\u00e6/g, "ae")
    .replace(/[ \t]+/g, " ");
}

function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[ \t]+/g, " ")
        .replace(/ {2,}/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function hasWord(folded: string, words: readonly string[]): boolean {
  return words.some((word) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(folded));
}

function countWords(folded: string, words: readonly string[]): number {
  let count = 0;
  for (const word of words) {
    if (new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(folded)) count += 1;
  }
  return count;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------------------------

const CURRENCY = String.raw`(?<![a-zA-Z])(€|eur(?:os)?\b|chf\b|£|\$|usd\b|gbp\b)`;
// « 1 234,56 » · « 1.234,56 » · « 1234.56 » · « 315,40 » · « 48 »
const NUMBER = String.raw`(\d{1,3}(?:[  .]\d{3})+|\d+)(?:[.,](\d{1,2}))?`;
const AMOUNT_WITH_CURRENCY = new RegExp(
  `(?:${CURRENCY}\\s*${NUMBER}|${NUMBER}\\s*${CURRENCY})(?!\\s*%)`,
  "gi",
);
const BARE_NUMBER = new RegExp(`${NUMBER}(?!\\s*%)(?![\\d])`, "g");

export function parseAmount(integerPart: string, decimalPart: string | undefined): number | null {
  const whole = Number(integerPart.replace(/[  .]/g, ""));
  if (!Number.isFinite(whole)) return null;
  const cents = decimalPart ? Number(decimalPart.padEnd(2, "0")) : 0;
  return Math.round(whole * 100 + cents) / 100;
}

type Money = { amount: number; currency: string | null; index: number; length: number };

function currencyCode(symbol: string | undefined): string | null {
  if (!symbol) return null;
  const s = symbol.toLowerCase();
  if (s === "€" || s.startsWith("eur")) return "EUR";
  if (s === "chf") return "CHF";
  if (s === "£" || s === "gbp") return "GBP";
  if (s === "$" || s === "usd") return "USD";
  return null;
}

/** Every amount written with a currency on the line. */
function moneyOnLine(line: string): Money[] {
  const found: Money[] = [];
  for (const match of line.matchAll(AMOUNT_WITH_CURRENCY)) {
    const [, cur1, int1, dec1, int2, dec2, cur2] = match;
    const amount = int1 ? parseAmount(int1, dec1) : int2 ? parseAmount(int2, dec2) : null;
    if (amount === null) continue;
    found.push({
      amount,
      currency: currencyCode(cur1 ?? cur2),
      index: match.index ?? 0,
      length: match[0].length,
    });
  }
  return found;
}

/** Every number on the line, currency or not — for the lines whose label says « total ». */
function numbersOnLine(line: string): Money[] {
  const found: Money[] = [];
  for (const match of line.matchAll(BARE_NUMBER)) {
    const [, int, dec] = match;
    if (!int) continue;
    // A date or a reference is not an amount: skip digit runs glued to / - . or letters.
    const before = line.charAt((match.index ?? 0) - 1);
    const after = line.charAt((match.index ?? 0) + match[0].length);
    if (/[/\-.\dA-Za-z]/.test(before) || /[/\-]/.test(after)) continue;
    const amount = parseAmount(int, dec);
    if (amount === null) continue;
    found.push({ amount, currency: null, index: match.index ?? 0, length: match[0].length });
  }
  return found;
}

const TOTAL_STRONG = ["net a payer", "total ttc", "montant ttc", "ttc", "a regler", "a payer"];
const TOTAL_WEAK = ["total", "montant total", "total general", "montant"];
const TOTAL_EXCLUDE = ["tva", "ht", "hors taxe", "acompte", "remise", "sous total", "sous-total"];

type TotalReading = { amount: number; currency: string | null; labelled: boolean } | null;

function findTotal(lines: string[]): TotalReading {
  let best: { priority: number; amount: number; currency: string | null } | null = null;
  for (const line of lines) {
    const folded = fold(line);
    const strong = hasWord(folded, TOTAL_STRONG);
    const weak = hasWord(folded, TOTAL_WEAK);
    if (!strong && !weak) continue;
    // « Total HT » and « TVA 20 % » carry figures that are not the total — unless the line also
    // says TTC, in which case the last amount is the one that counts.
    if (!strong && hasWord(folded, TOTAL_EXCLUDE)) continue;
    if (strong && hasWord(folded, ["ht", "hors taxe", "tva"]) && !hasWord(folded, ["ttc"])) {
      continue;
    }
    const money = moneyOnLine(line);
    const numbers = money.length > 0 ? money : numbersOnLine(line);
    const last = numbers[numbers.length - 1];
    if (!last) continue;
    const priority = strong ? 2 : 1;
    if (
      !best ||
      priority > best.priority ||
      (priority === best.priority && last.amount > best.amount)
    ) {
      best = { priority, amount: last.amount, currency: last.currency };
    }
  }
  if (best) return { amount: best.amount, currency: best.currency, labelled: true };

  // No labelled total: the largest amount written with a currency, flagged as a guess.
  let largest: Money | null = null;
  for (const line of lines) {
    for (const money of moneyOnLine(line)) {
      if (!largest || money.amount > largest.amount) largest = money;
    }
  }
  return largest ? { amount: largest.amount, currency: largest.currency, labelled: false } : null;
}

function documentCurrency(lines: string[]): string | null {
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const money of moneyOnLine(line)) {
      if (money.currency) counts.set(money.currency, (counts.get(money.currency) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  janvier: 1,
  janv: 1,
  jan: 1,
  fevrier: 2,
  fev: 2,
  feb: 2,
  mars: 3,
  mar: 3,
  avril: 4,
  avr: 4,
  apr: 4,
  mai: 5,
  may: 5,
  juin: 6,
  jun: 6,
  juillet: 7,
  juil: 7,
  jul: 7,
  aout: 8,
  aug: 8,
  septembre: 9,
  sept: 9,
  sep: 9,
  octobre: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  decembre: 12,
  dec: 12,
};

const NUMERIC_DATE = /(?<![\d/.-])(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d/.-])/g;
const ISO_DATE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;
const WRITTEN_DATE = /(?<!\d)(\d{1,2})(?:er)?\s+([a-z]{3,9})\.?\s+(\d{4})(?!\d)/g;

const DATE_LABEL = [
  "date",
  "le",
  "emis",
  "emise",
  "etabli",
  "etablie",
  "facture le",
  "edite",
  "edition",
  "du",
];
const DATE_REJECT = [
  "echeance",
  "validite",
  "valable",
  "livraison",
  "naissance",
  "expir",
  "paiement",
  "reglement",
  "limite",
  "avant le",
  "jusqu",
];

function isoDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

type DateReading = { date: string; labelled: boolean } | null;

/**
 * The document's date: the first date whose label says it is one (« Date : », « Le », « Émise
 * le »), never one labelled as a deadline or a validity, never one in the future, years 2000
 * onwards. Without a label, the first plausible date on the page.
 */
export function findDate(lines: string[], today: string): DateReading {
  const candidates: { date: string; score: number; order: number }[] = [];
  let order = 0;
  const consider = (date: string | null, folded: string, index: number) => {
    if (!date || date > today || date < "2000-01-01") return;
    const before = folded.slice(Math.max(0, index - 28), index);
    let score = 1;
    if (hasWord(before, DATE_REJECT)) score = 0;
    else if (hasWord(before, DATE_LABEL)) score = 2;
    candidates.push({ date, score, order: order++ });
  };
  for (const line of lines) {
    const folded = fold(line);
    for (const match of folded.matchAll(NUMERIC_DATE)) {
      const [, d, m, y] = match;
      const year = y!.length === 2 ? 2000 + Number(y) : Number(y);
      consider(isoDate(year, Number(m), Number(d)), folded, match.index ?? 0);
    }
    for (const match of folded.matchAll(ISO_DATE)) {
      const [, y, m, d] = match;
      consider(isoDate(Number(y), Number(m), Number(d)), folded, match.index ?? 0);
    }
    for (const match of folded.matchAll(WRITTEN_DATE)) {
      const [, d, month, y] = match;
      const m = MONTHS[month!];
      if (m) consider(isoDate(Number(y), m, Number(d)), folded, match.index ?? 0);
    }
  }
  const best = candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)[0];
  return best ? { date: best.date, labelled: best.score === 2 } : null;
}

// ---------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------

const LABOUR = [
  "main d.?oeuvre",
  "m\\.o\\.",
  "mo",
  "forfait",
  "intervention",
  "reparation",
  "remplacement",
  "vidange",
  "revision",
  "carenage",
  "pose",
  "depose",
  "montage",
  "demontage",
  "reglage",
  "controle",
  "diagnostic",
  "hivernage",
  "entretien",
  "taux horaire",
  "heures? de travail",
  "deplacement",
  "expertise",
  "grutage",
  "manutention",
  "sortie d.?eau",
  "mise a l.?eau",
  "calage",
  "nettoyage",
  "installation",
  "mise en service",
];

const GAS = [
  "gasoil",
  "gazole",
  "diesel",
  "essence",
  "sp95",
  "sp98",
  "e10",
  "carburant",
  "gpl",
  "butane",
  "propane",
  "bouteille de gaz",
  "litres?",
  "station",
  "fuel",
  "plein",
];

const PART = [
  "filtre",
  "huile",
  "anode",
  "turbine",
  "impeller",
  "piece",
  "pieces",
  "ref\\.?",
  "kit",
  "courroie",
  "pompe",
  "joint",
  "bougie",
  "batterie",
  "cable",
  "fusible",
  "ampoule",
  "cordage",
  "drisse",
  "ecoute",
  "manille",
  "poulie",
  "vanne",
  "passe.coque",
  "helice",
  "roulement",
  "thermostat",
  "injecteur",
  "capteur",
  "antifouling",
  "peinture",
  "mastic",
  "graisse",
  "liquide",
  "vis",
  "boulon",
  "ecrou",
];

const TYPE_INVOICE = ["facture", "invoice", "note d.?honoraires", "avoir"];
const TYPE_QUOTE = ["devis", "quote", "quotation", "proposition commerciale", "estimation"];
const TYPE_RECEIPT = [
  "ticket",
  "recu",
  "reçu",
  "caisse",
  "carte bancaire",
  "cb",
  "sans contact",
  "contactless",
  "merci de votre visite",
  "tva incluse",
  "especes",
  "monnaie",
  "rendu",
];
const TYPE_REPORT = [
  "rapport",
  "compte.rendu",
  "expertise",
  "releve",
  "proces.verbal",
  "controle technique",
];

/**
 * The boat's systems, by family: the words a document uses, and the template refs and names
 * of the categories a family lands on. Order matters when families tie: the first wins.
 */
const FAMILIES: {
  refs: string[];
  names: string[];
  words: string[];
}[] = [
  {
    refs: ["engines"],
    names: ["moteur", "propulsion", "hors-bord", "hors bord"],
    words: [
      "moteur",
      "moteurs",
      "vidange",
      "huile moteur",
      "filtre a huile",
      "filtre a gasoil",
      "filtre gasoil",
      "turbine",
      "impeller",
      "injecteur",
      "injecteurs",
      "courroie",
      "alternateur",
      "demarreur",
      "bougie",
      "bougies",
      "helice",
      "helices",
      "sail.?drive",
      "saildrive",
      "embase",
      "inverseur",
      "arbre d.?helice",
      "presse.etoupe",
      "echappement",
      "refroidissement",
      "thermostat",
      "yanmar",
      "volvo",
      "nanni",
      "mercury",
      "yamaha",
      "suzuki",
      "honda",
      "tohatsu",
      "lombardini",
      "hors.bord",
      "compteur",
      "horametre",
      "heures moteur",
      "soufflet",
      "anode d.?embase",
      "kit d.?entretien",
    ],
  },
  {
    refs: ["sails_rigging"],
    names: ["voile", "greement", "mat"],
    words: [
      "voile",
      "voiles",
      "grand.voile",
      "genois",
      "foc",
      "spi",
      "gennaker",
      "code 0",
      "drisse",
      "drisses",
      "ecoute",
      "ecoutes",
      "hauban",
      "haubans",
      "etai",
      "pataras",
      "mat",
      "bome",
      "enrouleur",
      "lazy.?bag",
      "lazy.?jack",
      "winch",
      "winchs",
      "winches",
      "ridoir",
      "ridoirs",
      "voilerie",
      "voilier",
      "greement",
      "cadene",
      "cadenes",
      "bout.dehors",
      "tangon",
    ],
  },
  {
    refs: ["hull_deck"],
    names: ["coque", "pont", "flotteur", "carene"],
    words: [
      "carenage",
      "antifouling",
      "gelcoat",
      "gel.coat",
      "osmose",
      "polish",
      "lustrage",
      "coque",
      "coques",
      "pont",
      "hublot",
      "hublots",
      "passe.coque",
      "passe.coques",
      "vanne",
      "vannes",
      "grutage",
      "sortie d.?eau",
      "mise a l.?eau",
      "manutention",
      "calage",
      "ber",
      "teck",
      "accastillage",
      "taquet",
      "davier",
      "balcon",
      "chandelier",
      "chandeliers",
      "filiere",
      "filieres",
      "nable",
      "capot",
      "anodes? de coque",
      "coppercoat",
      "peinture",
      "stratification",
      "stratifie",
      "resine",
      "epoxy",
    ],
  },
  {
    refs: ["electronics_nav"],
    names: ["electronique", "nav", "navigation", "instruments"],
    words: [
      "gps",
      "vhf",
      "ais",
      "radar",
      "sondeur",
      "pilote",
      "pilote automatique",
      "traceur",
      "antenne",
      "girouette",
      "anemometre",
      "loch",
      "speedo",
      "ecran",
      "afficheur",
      "nmea",
      "electronique",
      "raymarine",
      "garmin",
      "b&g",
      "navico",
      "simrad",
      "furuno",
      "lowrance",
      "compas",
      "centrale de navigation",
      "capteur de vent",
    ],
  },
  {
    refs: ["energy"],
    names: ["energie", "electricite", "electrique"],
    words: [
      "batterie",
      "batteries",
      "chargeur",
      "convertisseur",
      "onduleur",
      "panneau solaire",
      "panneaux solaires",
      "solaire",
      "eolienne",
      "hydrogenerateur",
      "regulateur",
      "fusible",
      "fusibles",
      "cablage",
      "cable",
      "cables",
      "tableau electrique",
      "electricite",
      "electrique",
      "quai",
      "prise de quai",
      "groupe electrogene",
      "generateur",
      "alternateur",
      "shunt",
      "victron",
      "mastervolt",
      "lithium",
      "agm",
    ],
  },
  {
    refs: ["plumbing_systems"],
    names: ["hydraulique", "circuit", "plomberie", "eau"],
    words: [
      "pompe",
      "pompes",
      "pompe de cale",
      "dessalinisateur",
      "watermaker",
      "chauffe.eau",
      "reservoir",
      "reservoirs",
      "wc",
      "toilettes",
      "tuyau",
      "tuyaux",
      "durite",
      "durites",
      "circuit d.?eau",
      "eau douce",
      "eaux noires",
      "eaux grises",
      "hydraulique",
      "verin",
      "verins",
      "plomberie",
      "robinet",
      "frigo",
      "refrigerateur",
      "climatisation",
      "chauffage",
      "gaz",
      "rechaud",
      "detendeur",
    ],
  },
  {
    refs: ["safety"],
    names: ["securite"],
    words: [
      "radeau",
      "survie",
      "gilet",
      "gilets",
      "extincteur",
      "extincteurs",
      "epirb",
      "plb",
      "feux a main",
      "fusees",
      "fusee",
      "harnais",
      "longe",
      "bouee",
      "balise",
      "securite",
      "trousse de secours",
      "pharmacie",
      "revision radeau",
      "detecteur",
      "alarme",
    ],
  },
  {
    refs: ["daggerboards_rudders"],
    names: ["derive", "safran", "quille", "transmission", "barre"],
    words: [
      "safran",
      "safrans",
      "derive",
      "derives",
      "quille",
      "meche",
      "barre",
      "barre a roue",
      "barre franche",
      "gouvernail",
      "palier",
      "paliers",
      "jaumiere",
      "bague",
      "bagues",
      "drosse",
      "drosses",
    ],
  },
  {
    refs: ["trailer"],
    names: ["remorque"],
    words: [
      "remorque",
      "treuil",
      "essieu",
      "feux de remorque",
      "attelage",
      "pneu",
      "pneus",
      "roulement",
    ],
  },
];

function findCategory(folded: string, context: InboxContext): string | null {
  let best: { family: (typeof FAMILIES)[number]; score: number } | null = null;
  for (const family of FAMILIES) {
    const score = countWords(folded, family.words);
    if (score > 0 && (!best || score > best.score)) best = { family, score };
  }
  if (!best) return null;
  const byRef = context.categories.find(
    (c) => c.externalRef && best!.family.refs.includes(c.externalRef),
  );
  if (byRef) return byRef.id;
  const byName = context.categories.find((c) => {
    const name = fold(c.name);
    return best!.family.names.some((word) => name.includes(word));
  });
  return byName?.id ?? null;
}

// ---------------------------------------------------------------------------------------------
// Supplier, hours, lines
// ---------------------------------------------------------------------------------------------

const HEADER_REJECT = [
  "facture",
  "devis",
  "ticket",
  "recu",
  "invoice",
  "quote",
  "total",
  "tel",
  "telephone",
  "fax",
  "siret",
  "siren",
  "tva",
  "www",
  "http",
  "page",
  "date",
  "client",
  "bateau",
  "n°",
  "numero",
  "iban",
  "bic",
  "rcs",
  "capital",
  "sas",
  "sarl",
  "eurl",
];

type SupplierReading = {
  contactId: string | null;
  supplierName: string | null;
  strength: 0 | 1 | 2;
};

function findSupplier(
  lines: string[],
  folded: string,
  input: HeuristicInput,
  context: InboxContext,
): SupplierReading {
  // One of the boat's contacts, when its name or company is on the page.
  let match: { id: string; label: string; length: number } | null = null;
  for (const contact of context.contacts) {
    for (const term of [contact.company, contact.name]) {
      if (!term) continue;
      const needle = fold(term).trim();
      if (needle.length < 4 || !folded.includes(needle)) continue;
      if (!match || needle.length > match.length) {
        match = { id: contact.id, label: term, length: needle.length };
      }
    }
  }
  if (match) return { contactId: match.id, supplierName: match.label, strength: 2 };

  // The header: the first line that reads like a name, not like a field.
  const boat = fold(context.boatName);
  for (const line of lines.slice(0, 8)) {
    const f = fold(line);
    const letters = (f.match(/[a-z]/g) ?? []).length;
    if (letters < 3 || line.length > 60) continue;
    if (moneyOnLine(line).length > 0) continue;
    if (/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(f) || /@/.test(f)) continue;
    if (hasWord(f, HEADER_REJECT)) continue;
    if (boat && f.includes(boat)) continue;
    return { contactId: null, supplierName: line, strength: 1 };
  }

  if (input.senderName) return { contactId: null, supplierName: input.senderName, strength: 1 };
  if (input.senderEmail) {
    const domain = input.senderEmail.split("@")[1]?.split(".")[0];
    if (
      domain &&
      ![
        "gmail",
        "hotmail",
        "outlook",
        "yahoo",
        "icloud",
        "orange",
        "free",
        "sfr",
        "wanadoo",
        "laposte",
      ].includes(domain)
    ) {
      return { contactId: null, supplierName: capitalise(domain), strength: 1 };
    }
  }
  return { contactId: null, supplierName: null, strength: 0 };
}

const HOURS_CONTEXT = ["compteur", "horametre", "heures moteur", "hours", "hour meter", "releve"];
const HOURS_NOT_A_READING = /(revision|service|entretien|toutes les|tous les|forfait|garantie)\s*$/;
const HOURS =
  /(\d{1,3}(?:[\u00a0 ]\d{3})+|\d{2,5})(?:[.,](\d))?\s*(?:h|hrs?|heures?|hours?)(?![a-z])/gi;

/** Which engine a piece of text names, by its last side word: « bâbord 1 512 h, tribord 1 498 h ». */
function engineSide(f: string): "port" | "starboard" | null {
  const port = Math.max(f.lastIndexOf("babord"), f.lastIndexOf(" port"), f.lastIndexOf(" bb"));
  const starboard = Math.max(
    f.lastIndexOf("tribord"),
    f.lastIndexOf("starboard"),
    f.lastIndexOf(" tb"),
    f.lastIndexOf(" sb"),
  );
  if (port < 0 && starboard < 0) return null;
  return port > starboard ? "port" : "starboard";
}

/**
 * Hour-meter readings: a number of hours whose nearby words say it is a reading (« compteur »,
 * « relevé »), not a service interval (« révision 500 h »), tied to the engine the words before it
 * name — or to the only engine of the boat.
 */
function findEngineHours(
  lines: string[],
  context: InboxContext,
): { engineId: string; hours: number }[] {
  if (context.engines.length === 0) return [];
  const readings: { engineId: string; hours: number }[] = [];
  for (const line of lines) {
    const f = fold(line);
    if (!hasWord(f, HOURS_CONTEXT)) continue;
    for (const match of f.matchAll(HOURS)) {
      const [, int, dec] = match;
      const index = match.index ?? 0;
      const before = f.slice(Math.max(0, index - 40), index);
      if (!hasWord(before, HOURS_CONTEXT) || HOURS_NOT_A_READING.test(before)) continue;
      const hours = Number(`${int!.replace(/[\u00a0 ]/g, "")}.${dec ?? "0"}`);
      if (!Number.isFinite(hours) || hours < 1 || hours > 99_999) continue;
      const side = engineSide(` ${before}`);
      const engine =
        context.engines.length === 1
          ? context.engines[0]
          : context.engines.find((e) => side !== null && engineSide(` ${fold(e.label)}`) === side);
      if (!engine || readings.some((r) => r.engineId === engine.id)) continue;
      readings.push({ engineId: engine.id, hours });
    }
  }
  return readings;
}

const LINE_REJECT = [
  "total",
  "sous.total",
  "tva",
  "ht",
  "ttc",
  "net a payer",
  "a payer",
  "montant",
  "remise",
  "acompte",
  "reste",
  "solde",
  "reglement",
  "paiement",
  "cb",
  "carte",
  "especes",
  "rendu",
];

const BARE_DECIMAL_AT_END = /(\d{1,3}(?:[\u00a0 .]\d{3})+|\d+)[.,](\d{2})\s*$/;
const TRAILING_QUANTITY = /\s+(?:x\s*)?\d+(?:[.,]\d+)?\s*(?:x|h|l|kg|g|m|ml|pcs?|u)?\s*$/i;

/**
 * The lines of the document: a designation, then an amount closing the line. On a tabular
 * invoice the line reads « Filtre à huile  2  21,50 €  43,00 € »: the designation stops at the
 * first amount, and a trailing quantity (« 2 », « 6 h », « x2 ») is dropped from it.
 */
function findLineItems(
  lines: string[],
  hasCurrency: boolean,
): { designation: string; amount: number | null }[] {
  const items: { designation: string; amount: number | null }[] = [];
  for (const line of lines) {
    const money = moneyOnLine(line);
    const last = money[money.length - 1];
    let amount: number | null = null;
    let cut: number | null = null;
    if (last && last.index + last.length >= line.length - 2) {
      amount = last.amount;
      cut = money[0]!.index;
    } else if (!last && hasCurrency) {
      // A receipt column without its symbol on every line: « ANODE ZINC 38,00 ».
      const bare = BARE_DECIMAL_AT_END.exec(line);
      if (bare) {
        amount = parseAmount(bare[1]!, bare[2]);
        cut = bare.index;
      }
    }
    if (amount === null || cut === null) continue;
    let designation = line
      .slice(0, cut)
      .replace(/[\s:–—-]+$/g, "")
      .trim();
    for (let i = 0; i < 2; i++) designation = designation.replace(TRAILING_QUANTITY, "").trim();
    const folded = fold(designation);
    if ((folded.match(/[a-z]/g) ?? []).length < 3) continue;
    if (hasWord(folded, LINE_REJECT)) continue;
    items.push({ designation, amount });
    if (items.length === 30) break;
  }
  return items;
}

// ---------------------------------------------------------------------------------------------
// The reading
// ---------------------------------------------------------------------------------------------

export function heuristicSuggestion(
  input: HeuristicInput,
  context: InboxContext,
): InboxSuggestion | null {
  const lines = toLines(input.text);
  const folded = fold(lines.join("\n"));
  if ((folded.match(/[a-z]/g) ?? []).length < 10) return null;

  const warnings: HeuristicWarningCode[] = ["local"];

  // What kind of paper
  const documentType: InboxModelOutput["documentType"] = hasWord(folded, TYPE_QUOTE)
    ? "quote"
    : hasWord(folded, TYPE_INVOICE)
      ? "invoice"
      : hasWord(folded, TYPE_REPORT)
        ? "report"
        : hasWord(folded, TYPE_RECEIPT)
          ? "receipt"
          : "other";

  // Figures
  const total = findTotal(lines);
  const date = findDate([...lines, input.fileName, input.subject ?? ""], context.today);
  const supplier = findSupplier(lines, folded, input, context);
  const currency = documentCurrency(lines);
  const lineItems = findLineItems(lines, currency !== null);
  const engineHours = findEngineHours(lines, context);
  const categoryId = findCategory(folded, context);

  // Where it goes
  const labour = hasWord(folded, LABOUR);
  const kind: InboxModelOutput["kind"] =
    documentType === "quote" || documentType === "report"
      ? "log"
      : documentType === "receipt"
        ? "purchase"
        : labour
          ? "log"
          : "purchase";
  const purchaseKind: VisiblePurchaseKind = labour
    ? "service"
    : hasWord(folded, GAS)
      ? "gas"
      : hasWord(folded, PART)
        ? "part"
        : "other";

  // A title that says what was done, or what was bought
  const labourLine = lineItems.find((item) => hasWord(fold(item.designation), LABOUR));
  const strip = (value: string) => value.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const withSupplier = (word: string) =>
    supplier.supplierName ? `${word} ${supplier.supplierName}` : word;
  const subjectLine = lines
    .map((line) => /^(?:objet|object|concerne|travaux)\s*:\s*(.+)$/i.exec(line)?.[1] ?? null)
    .find((value): value is string => value !== null && value.length >= 6);
  let title: string;
  if (kind === "log") {
    if (documentType === "quote") title = withSupplier("Devis");
    else if (subjectLine) title = capitalise(strip(subjectLine.split(/\s+[—–-]\s+/)[0]!.trim()));
    else if (labourLine) title = capitalise(strip(labourLine.designation));
    else if (documentType === "report") title = withSupplier("Rapport");
    else title = withSupplier("Intervention");
  } else {
    const first = lineItems[0];
    title = first
      ? capitalise(strip(first.designation))
      : input.subject?.trim() || withSupplier("Achat");
  }

  // What the person should look at
  if (!date) warnings.push("noDate");
  else if (!date.labelled) warnings.push("dateUnlabelled");
  if (!total) warnings.push("noAmount");
  else if (!total.labelled) warnings.push("amountGuessed");
  if (!supplier.supplierName) warnings.push("noSupplier");
  if (kind === "log" && !categoryId) warnings.push("noCategory");
  const ocr = input.ocrConfidence ?? null;
  if (ocr !== null && ocr < 70) warnings.push("ocrQuality");

  // How sure the reading is
  let points = 0;
  points += date ? (date.labelled ? 2 : 1) : 0;
  points += total ? (total.labelled ? 2 : 1) : 0;
  points += supplier.strength;
  points += documentType === "other" ? 0 : 1;
  let confidence: InboxModelOutput["confidence"] =
    points >= 7 ? "high" : points >= 4 ? "medium" : "low";
  if (ocr !== null && ocr < 55) confidence = "low";
  else if (ocr !== null && ocr < 70 && confidence === "high") confidence = "medium";

  const output: InboxModelOutput = {
    documentType,
    kind,
    purchaseKind,
    title,
    date: date?.date ?? null,
    amount: total?.amount ?? null,
    currency: total ? (total.currency ?? currency ?? "EUR") : null,
    supplierName: supplier.supplierName,
    contactId: supplier.contactId,
    categoryId,
    engineHours,
    lineItems,
    notes: null,
    confidence,
    warnings,
  };
  return normaliseSuggestion(output, context);
}
