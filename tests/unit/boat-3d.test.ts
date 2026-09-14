import { describe, expect, it } from "vitest";

import { buildBoatMesh, meshZones, type BoatShape } from "../../src/lib/boat-3d/model";
import { buildZoneSummaries } from "../../src/lib/boat-3d/summary";
import { fitCamera, Projector } from "../../src/lib/boat-3d/scene";
import {
  normalise,
  zoneForEquipment,
  zoneForItem,
  type ZoneKey,
} from "../../src/lib/boat-3d/zones";

const CAT: BoatShape = {
  type: "catamaran",
  lengthM: 15.24,
  beamM: 7.9,
  draftM: 1.2,
  engines: [
    { id: "eng-port", position: "port" },
    { id: "eng-stb", position: "starboard" },
  ],
};

const catZones = meshZones(buildBoatMesh(CAT));

describe("maillage du bateau", () => {
  it("dessine un catamaran complet, gréé, avec une zone par moteur", () => {
    const mesh = buildBoatMesh(CAT);
    const zones = meshZones(mesh);
    for (const zone of [
      "hulls",
      "mast",
      "mainsail",
      "headsail",
      "bow",
      "crossbeam",
      "trampoline",
      "coachroof",
      "cockpit",
      "daggerboards",
      "rudders",
      "systems",
      "safety",
      "engine:eng-port",
      "engine:eng-stb",
    ] satisfies ZoneKey[]) {
      expect(zones.has(zone), zone).toBe(true);
    }
    // Every face points at a part that exists, and every part at a zone.
    for (const face of mesh.faces) {
      expect(mesh.parts[face.part]).toBeDefined();
      expect(face.indices.length).toBeGreaterThanOrEqual(3);
      for (const index of face.indices) {
        expect(index).toBeLessThan(mesh.vertices.length / 3);
      }
    }
  });

  it("tient dans une enveloppe centrée sur l'origine", () => {
    const mesh = buildBoatMesh(CAT);
    expect(mesh.radius).toBeGreaterThan(0);
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const x = mesh.vertices[i] ?? 0;
      const y = mesh.vertices[i + 1] ?? 0;
      const z = mesh.vertices[i + 2] ?? 0;
      expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(mesh.radius + 1e-3);
    }
  });

  it("dessine un bateau de gabarit quand le carnet ne donne aucune dimension", () => {
    const mesh = buildBoatMesh({ ...CAT, lengthM: null, beamM: null, draftM: null });
    expect(mesh.faces.length).toBeGreaterThan(50);
    expect(meshZones(mesh).has("mast")).toBe(true);
  });

  it("ne gréé pas un bateau à moteur et ne lui met pas de dérives", () => {
    const zones = meshZones(
      buildBoatMesh({
        type: "motor",
        lengthM: 11,
        beamM: 3.6,
        draftM: 0.9,
        engines: [{ id: "in", position: "center" }],
      }),
    );
    expect(zones.has("mast")).toBe(false);
    expect(zones.has("daggerboards")).toBe(false);
    expect(zones.has("trampoline")).toBe(false);
    expect(zones.has("hulls")).toBe(true);
    expect(zones.has("engine:in")).toBe(true);
  });

  it("donne une quille au monocoque et garde ses safrans", () => {
    const zones = meshZones(
      buildBoatMesh({
        type: "monohull_sail",
        lengthM: 12,
        beamM: 3.9,
        draftM: 1.9,
        engines: [],
      }),
    );
    expect(zones.has("daggerboards")).toBe(true);
    expect(zones.has("rudders")).toBe(true);
    expect(zones.has("mast")).toBe(true);
  });

  it("refuse une largeur absurde plutôt que de dessiner un radeau", () => {
    const mesh = buildBoatMesh({ ...CAT, beamM: 70 });
    let maxX = 0;
    for (let i = 0; i < mesh.vertices.length; i += 3)
      maxX = Math.max(maxX, Math.abs(mesh.vertices[i] ?? 0));
    // Clamped to the length: the widest a boat is allowed to be.
    expect(maxX).toBeLessThanOrEqual(15.24);
  });
});

describe("cadrage et projection", () => {
  it("garde le bateau dans le cadre sur un tour complet", () => {
    const mesh = buildBoatMesh(CAT);
    const width = 640;
    const height = 420;
    const fit = fitCamera(mesh, { pitch: 0.4, width, height, fill: 0.9 });
    const projector = new Projector(mesh);
    for (let a = 0; a < 24; a += 1) {
      projector.run({ yaw: (a / 24) * Math.PI * 2, pitch: 0.4, width, height, fit });
      for (let i = 0; i < projector.x.length; i += 1) {
        expect(projector.x[i]).toBeGreaterThanOrEqual(0);
        expect(projector.x[i]).toBeLessThanOrEqual(width);
        expect(projector.y[i]).toBeGreaterThanOrEqual(0);
        expect(projector.y[i]).toBeLessThanOrEqual(height);
      }
    }
  });

  it("touche bien la face la plus proche, sur un tour complet", () => {
    const mesh = buildBoatMesh(CAT);
    const width = 640;
    const height = 420;
    const fit = fitCamera(mesh, { pitch: 0.4, width, height, fill: 0.9 });
    const projector = new Projector(mesh);
    for (let a = 0; a < 12; a += 1) {
      projector.run({ yaw: (a / 12) * Math.PI * 2, pitch: 0.4, width, height, fit });
      // The nearest face is the last one the painter draws: tapping its own centre must land
      // on it and on nothing behind it.
      const front = projector.order[projector.order.length - 1] ?? 0;
      const indices = mesh.faces[front]?.indices ?? [];
      let x = 0;
      let y = 0;
      for (const i of indices) {
        x += projector.x[i] ?? 0;
        y += projector.y[i] ?? 0;
      }
      expect(projector.hit(x / indices.length, y / indices.length)).toBe(front);
    }
  });

  it("ne touche rien à côté du bateau", () => {
    const mesh = buildBoatMesh(CAT);
    const fit = fitCamera(mesh, { pitch: 0.4, width: 640, height: 420, fill: 0.9 });
    const projector = new Projector(mesh);
    projector.run({ yaw: 0.8, pitch: 0.4, width: 640, height: 420, fit });
    expect(projector.hit(2, 2)).toBeNull();
  });

  it("trie les faces de la plus lointaine à la plus proche", () => {
    const mesh = buildBoatMesh(CAT);
    const camera = {
      yaw: 0.8,
      pitch: 0.4,
      width: 400,
      height: 300,
      fit: fitCamera(mesh, { pitch: 0.4, width: 400, height: 300, fill: 0.9 }),
    };
    const projector = new Projector(mesh);
    projector.run(camera);
    const depth = (face: number) => {
      const indices = mesh.faces[face]?.indices ?? [];
      return indices.reduce((sum, i) => sum + (projector.depth[i] ?? 0), 0) / indices.length;
    };
    for (let i = 1; i < projector.order.length; i += 1) {
      expect(depth(projector.order[i - 1] ?? 0)).toBeGreaterThanOrEqual(
        depth(projector.order[i] ?? 0) - 1e-3,
      );
    }
  });
});

describe("routage vers une zone", () => {
  const zone = (name: string, categoryRef: string | null = null) =>
    zoneForEquipment({ name, categoryRef }, catZones);

  it("lit les mots avant la catégorie", () => {
    // Both are filed under the same system by the ORC 50 template, and are two different places.
    expect(zone("Safrans suspendus", "daggerboards_rudders")).toBe("rudders");
    expect(zone("Dérives sabres carbone", "daggerboards_rudders")).toBe("daggerboards");
  });

  it("place l'inventaire de Xaman là où il est vraiment", () => {
    const cases: [string, string, ZoneKey][] = [
      ["Mât carbone croisière fixe", "sails_rigging", "mast"],
      ["Winch électrique pied de mât tribord", "sails_rigging", "mast"],
      ["Grand-voile (GV)", "sails_rigging", "mainsail"],
      ["J1 (Génois)", "sails_rigging", "headsail"],
      ["Code 0 (J0)", "sails_rigging", "headsail"],
      ["Spi léger (A0)", "sails_rigging", "headsail"],
      ["Emmagasineurs Karver", "sails_rigging", "headsail"],
      ["Ancre", "hull_deck", "bow"],
      ["Chaîne de mouillage", "hull_deck", "bow"],
      ["Guindeau électrique", "hull_deck", "bow"],
      ["Coque sandwich PVC foam core / vinylester", "hull_deck", "hulls"],
      ["Antifouling", "hull_deck", "hulls"],
      ["Jupes de flotteur allongées", "hull_deck", "hulls"],
      ["Traverse (croix) carbone", "hull_deck", "crossbeam"],
      ["Cloison de mât + poutre arrière", "hull_deck", "crossbeam"],
      ["Roof et cloisons de roof", "hull_deck", "coachroof"],
      ["Panneaux solaires monocristallins", "energy", "coachroof"],
      ["Starlink", "electronics_nav", "coachroof"],
      ["Batteries Lithium", "energy", "systems"],
      ["Chargeur de quai + isolateur galvanique", "energy", "systems"],
      ["Convertisseur / chargeur", "energy", "systems"],
      ["Traceur", "electronics_nav", "cockpit"],
      ["Tablette durcie Sailproof", "electronics_nav", "cockpit"],
      ["Dessalinisateur", "plumbing_systems", "systems"],
      ["Réfrigérateur custom", "plumbing_systems", "systems"],
      ["Lave-linge", "plumbing_systems", "systems"],
      ["Kit de sécurité catégorie A — 10 personnes", "safety", "safety"],
    ];
    for (const [name, ref, expected] of cases) {
      expect(zone(name, ref), name).toBe(expected);
    }
  });

  it("retombe sur la catégorie quand les mots ne disent rien", () => {
    expect(zone("Modèle X-42", "electronics_nav")).toBe("cockpit");
    expect(zone("Modèle X-42", "safety")).toBe("safety");
  });

  it("ne laisse jamais une ligne sans endroit", () => {
    expect(zone("Chose sans nom connu", null)).toBe("hulls");
    expect(zone("Chose sans nom connu", "categorie-inconnue")).toBe("hulls");
  });

  it("replie sur une zone voisine quand le bateau n'a pas celle visée", () => {
    const motor = meshZones(
      buildBoatMesh({ type: "motor", lengthM: 11, beamM: 3.6, draftM: 0.9, engines: [] }),
    );
    // No rig aboard: sail gear lands on the hull rather than nowhere.
    expect(zoneForEquipment({ name: "Grand-voile", categoryRef: null }, motor)).toBe("hulls");
    expect(zoneForEquipment({ name: "Dérive", categoryRef: null }, motor)).toBe("rudders");
  });

  it("rattache un point de checklist à son moteur, quel que soit son libellé", () => {
    expect(zoneForItem({ label: "Vidange", engineId: "eng-port" }, catZones)).toBe(
      "engine:eng-port",
    );
    // Even a word that points elsewhere loses to the engine the base names.
    expect(zoneForItem({ label: "Contrôle du mât", engineId: "eng-stb" }, catZones)).toBe(
      "engine:eng-stb",
    );
    expect(zoneForItem({ label: "Contrôle du mât", engineId: null }, catZones)).toBe("mast");
  });

  it("normalise les accents et n'attrape un mot qu'à son début", () => {
    expect(normalise("Dérives sabres")).toBe(" derives sabres ");
    // « gv » must not fire inside « ogive ».
    expect(zone("Ogive de drisse", null)).toBe("mast");
  });
});

describe("résumé par zone", () => {
  const mesh = buildBoatMesh(CAT);
  const summaries = buildZoneSummaries({
    mesh,
    hasKeel: false,
    categories: [
      { id: "c-sails", externalRef: "sails_rigging" },
      { id: "c-engines", externalRef: "engines" },
    ],
    equipment: [
      {
        id: "e1",
        name: "Mât carbone",
        brand: "Lorima",
        model: null,
        quantity: 1,
        categoryId: "c-sails",
      },
    ],
    points: [
      {
        id: "p1",
        label: "Haubans",
        state: "soon",
        daysRemaining: 10,
        hoursRemaining: null,
        hasCounter: true,
        categoryId: "c-sails",
        engineId: null,
      },
      {
        id: "p2",
        label: "Capelage",
        state: "overdue",
        daysRemaining: -4,
        hoursRemaining: null,
        hasCounter: true,
        categoryId: "c-sails",
        engineId: null,
      },
      {
        id: "p3",
        label: "Anodes",
        state: "ok",
        daysRemaining: 90,
        hoursRemaining: null,
        hasCounter: true,
        categoryId: "c-engines",
        engineId: "eng-port",
      },
    ],
    engines: [
      { id: "eng-port", label: "Moteur BB" },
      { id: "eng-stb", label: "Moteur TB" },
    ],
  });
  const byKey = new Map(summaries.map((summary) => [summary.key, summary]));

  it("donne une ligne à chaque zone du maillage, même vide", () => {
    expect(summaries.length).toBe(meshZones(mesh).size);
    expect(byKey.get("trampoline")?.points).toEqual([]);
    expect(byKey.get("trampoline")?.state).toBeNull();
  });

  it("retient le pire état et compte les retards", () => {
    const mast = byKey.get("mast");
    expect(mast?.state).toBe("overdue");
    expect(mast?.overdue).toBe(1);
    expect(mast?.soon).toBe(1);
    // The worst is listed first: a zone is opened to find what is late on it.
    expect(mast?.points.map((point) => point.label)).toEqual(["Capelage", "Haubans"]);
    expect(mast?.things.map((thing) => thing.name)).toEqual(["Mât carbone"]);
  });

  it("nomme une zone moteur d'après le moteur", () => {
    expect(byKey.get("engine:eng-port")?.name).toBe("Moteur BB");
    expect(byKey.get("engine:eng-port")?.points.map((p) => p.label)).toEqual(["Anodes"]);
    expect(byKey.get("engine:eng-port")?.labelKey).toBeNull();
    expect(byKey.get("mast")?.labelKey).toBe("mast");
  });

  it("dit « quille » plutôt que « dérives » sur un monocoque", () => {
    const monohull = buildBoatMesh({
      type: "monohull_sail",
      lengthM: 12,
      beamM: 3.9,
      draftM: 1.9,
      engines: [],
    });
    const zones = buildZoneSummaries({
      mesh: monohull,
      hasKeel: true,
      categories: [],
      equipment: [],
      points: [],
      engines: [],
    });
    expect(zones.find((zone) => zone.key === "daggerboards")?.labelKey).toBe("keel");
  });
});
