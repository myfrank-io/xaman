import { describe, expect, it } from "vitest";

import { specsRecord, toBoatModelData, type BoatModelInput } from "@/lib/boat-3d/data";

/**
 * L'assemblage de la maquette (E2-8), partagé depuis D124 par l'onglet Bateau et par « À bord ».
 *
 * Deux écrans dessinent maintenant le même bateau à partir des mêmes lignes : ce qui est fixé
 * ici est ce qui les ferait diverger — un équipement déposé qu'un écran dessinerait encore, un
 * moteur désactivé qui changerait la coque, un point sans état qui ferait planter le calcul des
 * zones.
 */
const INPUT: BoatModelInput = {
  boat: { type: "catamaran", length_m: 15.2, beam_m: 7.8, draft_m: 1.4 },
  engines: [
    { id: "e1", position: "port", is_active: true, label: "Moteur BB" },
    { id: "e2", position: "starboard", is_active: false, label: "Moteur SB (déposé)" },
  ],
  categories: [{ id: "c1", external_ref: "engines" }],
  equipment: [
    {
      id: "q1",
      name: "Grand-voile",
      brand: "Incidence",
      model: null,
      quantity: 1,
      category_id: "c1",
      external_ref: "GREM17",
      removed_at: null,
      specs: { area_m2: "88" },
    },
    {
      id: "q2",
      name: "Ancien guindeau",
      brand: null,
      model: null,
      quantity: 1,
      category_id: "c1",
      external_ref: null,
      removed_at: "2025-06-01",
      specs: null,
    },
  ],
  points: [
    {
      id: "p1",
      label: "Vidange",
      status: "overdue",
      days_remaining: -12,
      hours_remaining: null,
      engine_tracks_hours: true,
      category_id: "c1",
      engine_id: "e1",
    },
    {
      id: null,
      label: null,
      status: null,
      days_remaining: null,
      hours_remaining: null,
      engine_tracks_hours: null,
      category_id: null,
      engine_id: null,
    },
  ],
};

describe("toBoatModelData", () => {
  it("draws the hull from the boat and its live engines", () => {
    const data = toBoatModelData(INPUT);
    expect(data.shape).toEqual({
      type: "catamaran",
      lengthM: 15.2,
      beamM: 7.8,
      draftM: 1.4,
      engines: [{ id: "e1", position: "port" }],
    });
  });

  it("still names a disabled engine, because its points keep their place", () => {
    // La coque ne le dessine plus, mais un point qui lui est lié doit garder un nom.
    expect(toBoatModelData(INPUT).engines).toEqual([
      { id: "e1", label: "Moteur BB" },
      { id: "e2", label: "Moteur SB (déposé)" },
    ]);
  });

  it("stops drawing an equipment that left the boat", () => {
    const equipment = toBoatModelData(INPUT).equipment;
    expect(equipment.map((item) => item.id)).toEqual(["q1"]);
    expect(equipment[0]?.specs).toEqual({ area_m2: "88" });
  });

  it("gives a point without a state the only honest default", () => {
    const points = toBoatModelData(INPUT).points;
    expect(points[1]).toEqual({
      id: "",
      label: "",
      state: "never",
      daysRemaining: null,
      hoursRemaining: null,
      hasCounter: true,
      categoryId: null,
      engineId: null,
    });
  });
});

describe("specsRecord", () => {
  it("keeps a plain object and refuses everything else", () => {
    expect(specsRecord({ area_m2: "88" })).toEqual({ area_m2: "88" });
    expect(specsRecord(null)).toBe(null);
    expect(specsRecord(["88"])).toBe(null);
    expect(specsRecord("88")).toBe(null);
  });
});
