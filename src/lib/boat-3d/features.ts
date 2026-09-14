import { normalise } from "@/lib/boat-3d/zones";

/**
 * What the carnet knows about **this** boat, read off its own inventory.
 *
 * The model is not a picture of an ORC 50 with the name changed: every feature below is a thing
 * the carnet records, and the hull is drawn with it or without it accordingly. Xaman has « Dérives
 * sabres carbone », « Safrans suspendus », « Jupes de flotteur allongées », 990 W of solar
 * « sur bossoirs » and 88 m² of mainsail — so it gets daggerboards, blades hung on the transoms,
 * long skirts, panels on the davits and a mainsail of that size. A boat that has none of those
 * gets none of them.
 *
 * That is also what makes the builder's document worth loading: every line it adds to the
 * inventory sharpens the drawing. Nothing here is stored — it is read from the equipment each
 * time, so an equipment added this morning is on the model this afternoon.
 */
export type EquipmentFact = {
  name: string;
  externalRef?: string | null;
  /** `equipment.specs`, free key/value pairs: « surface_m2 », « emplacement »… */
  specs?: Readonly<Record<string, unknown>> | null;
};

export type BoatFeatures = {
  /** « Dérives sabres » — boards, rather than a keel or nothing. */
  daggerboards: boolean;
  /** « Safrans suspendus » — blades on the transoms rather than under the hull. */
  transomRudders: boolean;
  /** « Jupes de flotteur allongées » — the hull leaves the water in a long slope. */
  skirts: boolean;
  /** A bowsprit: named as such, or implied by a Code 0, a spinnaker or a furler. */
  bowsprit: boolean;
  /** Where the panels are. Null = none aboard. */
  solar: "davits" | "roof" | null;
  windlass: boolean;
  anchor: boolean;
  /** A winch at the foot of the mast, and which side it is on. */
  mastWinch: "port" | "starboard" | null;
  liferaft: boolean;
  /** A dome on deck: Starlink, a radome. */
  dome: boolean;
  /** Mainsail area in m², when the carnet records it. */
  mainsailArea: number | null;
  /** The largest headsail area in m². */
  headsailArea: number | null;
};

/** Everything a line says about itself: its name, its seed reference, and its specs. */
function haystack(item: EquipmentFact): string {
  const specs = Object.entries(item.specs ?? {})
    .map(([key, value]) => `${key} ${value === null || value === undefined ? "" : String(value)}`)
    .join(" ");
  return normalise(`${item.name} ${item.externalRef ?? ""} ${specs}`);
}

function has(hay: string, words: readonly string[]): boolean {
  return words.some((word) => hay.includes(` ${word}`));
}

function area(item: EquipmentFact): number | null {
  const raw = item.specs?.["surface_m2"];
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

const MAINSAIL = ["grand voile", "grandvoile", "gv", "main"];
/**
 * The working headsail — the one that is up most of the time, and the one the model draws. A
 * Code 0 and a spinnaker are twice its size and live rolled on the sprit: counted here they
 * would put a 220 m² sail on a fifteen-metre boat.
 */
const HEADSAIL = ["genois", "genoa", "j1", "j2", "j3", "solent", "trinquette", "foc", "jib"];
const FLYING = ["spi", "gennaker", "a0", "a2", "a4", "code 0", "code0", "j0", "emmagasineur"];

export function readFeatures(equipment: readonly EquipmentFact[]): BoatFeatures {
  const facts = equipment.map((item) => ({ item, hay: haystack(item) }));
  const any = (words: readonly string[]) => facts.some(({ hay }) => has(hay, words));
  const find = (words: readonly string[]) => facts.find(({ hay }) => has(hay, words));

  const solarLine = find(["solaire", "solar", "photovoltaique"]);
  const solar = solarLine
    ? has(solarLine.hay, ["bossoir", "davit", "portique", "arceau", "arriere"])
      ? ("davits" as const)
      : ("roof" as const)
    : null;

  const winch = find(["winch", "cabestan"]);
  const mastWinch =
    winch && has(winch.hay, ["mat", "mast"])
      ? has(winch.hay, ["tribord", "starboard"])
        ? ("starboard" as const)
        : has(winch.hay, ["babord", "port"])
          ? ("port" as const)
          : ("starboard" as const)
      : null;

  let mainsailArea: number | null = null;
  let headsailArea: number | null = null;
  for (const { item, hay } of facts) {
    const surface = area(item);
    if (surface === null) continue;
    if (has(hay, MAINSAIL)) mainsailArea = Math.max(mainsailArea ?? 0, surface);
    else if (has(hay, HEADSAIL)) headsailArea = Math.max(headsailArea ?? 0, surface);
  }

  return {
    daggerboards: any(["derive", "daggerboard", "centreboard"]),
    transomRudders: any(["safran", "rudder"]) && any(["suspendu", "releva", "tableau"]),
    skirts: any(["jupe", "skirt"]),
    bowsprit: any(["bout dehors", "bowsprit", "beaupre"]) || any(FLYING),
    solar,
    windlass: any(["guindeau", "windlass"]),
    anchor: any(["ancre", "anchor", "mouillage"]),
    mastWinch,
    liferaft: any(["radeau", "liferaft", "survie", "securite", "safety"]),
    dome: any(["starlink", "radome", "radar", "antenne", "dome"]),
    mainsailArea,
    headsailArea,
  };
}

/**
 * What is drawn when the inventory is still empty — a carnet opened this morning. Deliberately
 * plain: the boat gets its hull, its rig and its rudders, and everything the carnet has not been
 * told about stays off until it is.
 */
export const NO_FEATURES: BoatFeatures = {
  daggerboards: false,
  transomRudders: false,
  skirts: false,
  bowsprit: false,
  solar: null,
  windlass: false,
  anchor: false,
  mastWinch: null,
  liferaft: false,
  dome: false,
  mainsailArea: null,
  headsailArea: null,
};
