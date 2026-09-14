/**
 * The physical places of a boat — the parts someone points at when they say « il y a un truc
 * à faire là-dessus ».
 *
 * A zone is not a category: `sails_rigging` is one system but the mast, the mainsail and the
 * headsails are three things you touch separately. So the model carries zones, and every
 * equipment line and every checklist point is routed to one of them — by name first (« safran »
 * is a rudder whichever system it was filed under), by category second, by fallback last.
 * Nothing is ever left unreachable: a line that matches nothing lands on the hull.
 */

/** The zones any boat can have, whatever its type. Engines are added per engine (see below). */
export const HULL_ZONES = [
  "mast",
  "mainsail",
  "headsail",
  "bow",
  "crossbeam",
  "trampoline",
  "coachroof",
  "cockpit",
  "hulls",
  "daggerboards",
  "rudders",
  "systems",
  "safety",
] as const;

export type HullZone = (typeof HULL_ZONES)[number];

/** A zone key: one of the fixed places, or one engine of this boat. */
export type ZoneKey = HullZone | `engine:${string}`;

export const ENGINE_ZONE_PREFIX = "engine:";

export function engineZone(engineId: string): ZoneKey {
  return `${ENGINE_ZONE_PREFIX}${engineId}`;
}

export function engineIdOf(zone: ZoneKey): string | null {
  return zone.startsWith(ENGINE_ZONE_PREFIX) ? zone.slice(ENGINE_ZONE_PREFIX.length) : null;
}

/**
 * Accent-free, lower-case, padded with a space on both ends so a pattern can be matched at the
 * **start of a word**: « derive » then finds « dérives sabres » and « puits de dérive », but
 * « gv » never fires inside « ogive ».
 */
export function normalise(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Where a rule's earliest word starts in the name, or -1 when none of them is there. */
function firstMatch(haystack: string, patterns: readonly string[]): number {
  let at = -1;
  for (const pattern of patterns) {
    const found = haystack.indexOf(` ${pattern}`);
    if (found >= 0 && (at < 0 || found < at)) at = found;
  }
  return at;
}

/**
 * The words of each zone — the ones the carnet actually uses: the ORC 50 checklist, the Xaman
 * inventory and the generic templates, in French, with the English a shipyard invoice brings
 * back.
 *
 * **The earliest word in the name wins**, not the first rule in this list. French puts the head
 * noun first, so « Cloison de mât + poutre arrière » is a bulkhead and « Roof et cloisons de
 * roof » is a coachroof — two names carrying the same two words, and the one that leads says
 * which. Rule order only settles a tie.
 */
const WORD_RULES: readonly { zone: HullZone; words: readonly string[] }[] = [
  // Structure first: « cloison de mât » is a bulkhead, and the word « mât » in it names the
  // place it holds up, not the spar it is about. « bras » and « beam » are deliberately absent —
  // a « bras de spi » is a sheet, and the boat would have swallowed the spinnaker gear.
  {
    zone: "crossbeam",
    words: ["traverse", "crossbeam", "poutre", "cloison", "bulkhead", "longeron", "structure"],
  },
  // Then the rig, before the sails: a « winch de mât » is mast work, not a sail.
  {
    zone: "mast",
    words: [
      "mat",
      "mast",
      "greement",
      "rigging",
      "hauban",
      "shroud",
      "etai",
      "stay",
      "drisse",
      "halyard",
      "girouette",
      "lazy",
      "winch",
      "bas de mat",
      "rail de mat",
      "capelage",
      "ridoir",
    ],
  },
  {
    zone: "mainsail",
    words: [
      "grand voile",
      "grandvoile",
      "gv",
      "main",
      "bome",
      "boom",
      "vang",
      "hale bas",
      "latte",
      "batten",
      "chariot",
      "bordure",
      "ris",
      "reef",
    ],
  },
  {
    zone: "headsail",
    words: [
      "genois",
      "genoa",
      "j1",
      "j2",
      "j3",
      "j0",
      "code 0",
      "code0",
      "spi",
      "a0",
      "a4",
      "gennaker",
      "trinquette",
      "solent",
      "foc",
      "jib",
      "emmagasineur",
      "furler",
      "enrouleur",
      "tourmentin",
    ],
  },
  {
    zone: "bow",
    words: [
      "ancre",
      "anchor",
      "chaine",
      "chain",
      "guindeau",
      "windlass",
      "mouillage",
      "bout dehors",
      "bowsprit",
      "davier",
      "etrave",
      "stem",
      "bosse",
      "orin",
    ],
  },
  {
    zone: "rudders",
    words: [
      "safran",
      "rudder",
      "barre",
      "helm",
      "meche",
      "tiller",
      "cardan",
      "gouvernail",
      "pilote",
      "autopilot",
      "verin",
    ],
  },
  {
    zone: "daggerboards",
    words: ["derive", "daggerboard", "centreboard", "puits", "quille", "keel", "lest", "ballast"],
  },
  {
    zone: "trampoline",
    words: ["trampoline", "filet", "net", "ralingue de filet"],
  },
  {
    zone: "coachroof",
    words: [
      "roof",
      "solaire",
      "solar",
      "panneau",
      "capote",
      "bimini",
      "taud",
      "sprayhood",
      "hydrogenerateur",
      "eolienne",
      "radome",
      "antenne",
      "starlink",
    ],
  },
  {
    zone: "cockpit",
    words: [
      "cockpit",
      "traceur",
      "plotter",
      "vhf",
      "ais",
      "radar",
      "instrument",
      "tablette",
      "sondeur",
      "loch",
      "speedo",
      "compas",
      "gps",
      "nav",
      "electronique",
      "b g",
      "bg",
      "garmin",
      "raymarine",
      "sailproof",
      "table a carte",
      "banquette",
    ],
  },
  {
    zone: "safety",
    words: [
      "securite",
      "safety",
      "radeau",
      "liferaft",
      "survie",
      "gilet",
      "brassiere",
      "extincteur",
      "fire",
      "fusee",
      "epirb",
      "balise",
      "harnais",
      "bouee",
      "homme a la mer",
      "mob",
      "pyrotechnie",
      "pharmacie",
    ],
  },
  {
    zone: "systems",
    words: [
      "batterie",
      "battery",
      "chargeur",
      "charger",
      "convertisseur",
      "inverter",
      "alternateur",
      "alternator",
      "coupe circuit",
      "parc",
      "dessalinisateur",
      "watermaker",
      "osmoseur",
      "pompe",
      "pump",
      "cale",
      "bilge",
      "frigo",
      "refrigerateur",
      "congelateur",
      "freezer",
      "chauffage",
      "heater",
      "clim",
      "gaz",
      "gas",
      "wc",
      "toilette",
      "lave linge",
      "reservoir",
      "tank",
      "eau douce",
      "circuit",
      "vanne",
      "seacock",
      "passe coque",
      "through hull",
      "groupe",
      "generateur",
      // An engine line is normally routed by its `engine_id` (see `zoneForItem`); these catch
      // the ones written down without one.
      "moteur",
      "engine",
      "saildrive",
      "helice",
      "propeller",
      "embase",
      "inverseur",
    ],
  },
  {
    zone: "hulls",
    words: [
      "coque",
      "hull",
      "antifouling",
      "carene",
      "coppercoat",
      "osmose",
      "jupe",
      "gelcoat",
      "anode",
      "pont",
      "deck",
      "hublot",
      "rouf",
      "flotteur",
      "tube",
    ],
  },
];

/** What a category means when the words said nothing: the template's `external_ref`. */
const CATEGORY_ZONES: Readonly<Record<string, HullZone>> = {
  engines: "systems",
  daggerboards_rudders: "rudders",
  sails_rigging: "mast",
  hull_deck: "hulls",
  electronics_nav: "cockpit",
  energy: "systems",
  plumbing_systems: "systems",
  safety: "safety",
  trailer: "hulls",
};

/** The place of last resort: every boat has a hull, so nothing can be unreachable. */
const FALLBACK: HullZone = "hulls";

function resolve(zone: HullZone, available: ReadonlySet<ZoneKey>): ZoneKey {
  if (available.has(zone)) return zone;
  // A boat without daggerboards still has rudders; one without a rig has a hull.
  if (zone === "daggerboards" && available.has("rudders")) return "rudders";
  if (zone === "mainsail" || zone === "headsail") {
    if (available.has("mast")) return "mast";
  }
  if (zone === "trampoline" || zone === "crossbeam") {
    if (available.has("hulls")) return "hulls";
  }
  return available.has(FALLBACK) ? FALLBACK : (([...available][0] ?? FALLBACK) as ZoneKey);
}

function zoneFromText(text: string): HullZone | null {
  const haystack = normalise(text);
  let best: { zone: HullZone; at: number } | null = null;
  for (const rule of WORD_RULES) {
    const at = firstMatch(haystack, rule.words);
    if (at < 0) continue;
    if (!best || at < best.at) best = { zone: rule.zone, at };
  }
  return best?.zone ?? null;
}

/**
 * Where a piece of equipment sits. The words of its name and of its seed reference are read
 * first: they are what a human would point at. The category only settles what the words left
 * open.
 */
export function zoneForEquipment(
  equipment: { name: string; externalRef?: string | null; categoryRef?: string | null },
  available: ReadonlySet<ZoneKey>,
): ZoneKey {
  const byWords = zoneFromText(`${equipment.name} ${equipment.externalRef ?? ""}`);
  if (byWords) return resolve(byWords, available);
  const byCategory = equipment.categoryRef ? CATEGORY_ZONES[equipment.categoryRef] : undefined;
  return resolve(byCategory ?? FALLBACK, available);
}

/**
 * Where a checklist point applies. A point attached to an engine belongs to **that** engine,
 * whatever it is called — that is the only link the base gives us, and it is exact.
 */
export function zoneForItem(
  item: { label: string; categoryRef?: string | null; engineId?: string | null },
  available: ReadonlySet<ZoneKey>,
): ZoneKey {
  if (item.engineId) {
    const zone = engineZone(item.engineId);
    if (available.has(zone)) return zone;
  }
  const byWords = zoneFromText(item.label);
  if (byWords) return resolve(byWords, available);
  const byCategory = item.categoryRef ? CATEGORY_ZONES[item.categoryRef] : undefined;
  return resolve(byCategory ?? FALLBACK, available);
}
