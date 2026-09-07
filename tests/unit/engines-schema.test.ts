import { describe, expect, it } from "vitest";

import { upsertEngineSchema } from "@/lib/schemas/engines";

const BOAT = "00000000-0000-4000-8000-0000000000b1";
const ENGINE = "00000000-0000-4000-8000-0000000000e1";

function engine(over: Record<string, unknown> = {}) {
  return {
    id: ENGINE,
    boatId: BOAT,
    label: "Annexe (hors-bord)",
    position: "outboard",
    brand: null,
    model: null,
    serial: null,
    installedAt: null,
    notes: null,
    ...over,
  };
}

// D73: the box on the engine form is « pas de compteur d'heures », so the schema carries its
// opposite — an engine tracks its hours unless someone says it has no meter.
describe("upsertEngineSchema — tracksHours (D73)", () => {
  it("assumes a meter when the form says nothing", () => {
    const parsed = upsertEngineSchema.parse(engine());
    expect(parsed.tracksHours).toBe(true);
  });

  it("keeps the absence of a meter as it was ticked", () => {
    expect(upsertEngineSchema.parse(engine({ tracksHours: false })).tracksHours).toBe(false);
    expect(upsertEngineSchema.parse(engine({ tracksHours: true })).tracksHours).toBe(true);
  });

  it("refuses anything that is not a yes or a no", () => {
    expect(upsertEngineSchema.safeParse(engine({ tracksHours: "non" })).success).toBe(false);
  });
});
