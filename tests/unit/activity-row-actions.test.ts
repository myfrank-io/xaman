import { describe, expect, it } from "vitest";

import { ACTIVITY_REMOVAL, activityOpenPath } from "@/components/activity/row-actions";
import { ACTIVITY_KINDS, type ActivityKind } from "@/lib/queries/activity";

const BOAT = "00000000-0000-0000-0000-00000000b001";
const ID = "00000000-0000-0000-0000-0000000000a1";

describe("ce qu'on peut faire d'une ligne du fil (D144)", () => {
  it("couvre les cinq faits, sans en oublier un", () => {
    expect(Object.keys(ACTIVITY_REMOVAL).sort()).toEqual([...ACTIVITY_KINDS].sort());
  });

  // Ce qui est un objet du carnet passe par la corbeille et revient ; ce qui est dérivé s'efface.
  it("passe par la corbeille ce qui en a une, et seulement ça", () => {
    const reversible = ACTIVITY_KINDS.filter((kind) => ACTIVITY_REMOVAL[kind] === "trash");
    expect(reversible).toEqual(["log", "purchase", "haul_out"]);
  });

  it("mène à l'écran du fait quand il en a un", () => {
    const paths = Object.fromEntries(
      ACTIVITY_KINDS.map((kind) => [kind, activityOpenPath(BOAT, { kind, id: ID })]),
    ) as Record<ActivityKind, string | null>;

    expect(paths.log).toBe(`/boats/${BOAT}/logs/${ID}`);
    expect(paths.purchase).toBe(`/boats/${BOAT}/supplies/purchases/${ID}/edit`);
    expect(paths.haul_out).toBe(`/boats/${BOAT}/haul-outs/${ID}`);
    // Un cochage mène à son point, que le fil ne porte pas ; un relevé n'a pas d'écran à lui.
    expect(paths.completion).toBeNull();
    expect(paths.reading).toBeNull();
  });

  it("ne laisse aucune ligne sans geste : ouvrir, ou retirer", () => {
    for (const kind of ACTIVITY_KINDS) {
      const hasScreen = activityOpenPath(BOAT, { kind, id: ID }) !== null;
      expect(hasScreen || ACTIVITY_REMOVAL[kind] !== undefined).toBe(true);
    }
  });
});
