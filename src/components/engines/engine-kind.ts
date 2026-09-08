import type { EnginePosition, EnginePropulsion } from "@/lib/schemas/engines";

/**
 * « Bâbord · Saildrive », « Hors-bord » — what an engine is, in the words its card and the report
 * put beside its name (D90).
 *
 * The position says where it sits and the propulsion what drives it; both are shown, except for
 * the one case where they would say the same word twice: a lone outboard keeps the `outboard`
 * position, and « Hors-bord · Hors-bord » helps nobody.
 */
export function engineKind(
  engine: { position: EnginePosition; propulsion: EnginePropulsion },
  positionLabel: (position: EnginePosition) => string,
  propulsionLabel: (propulsion: EnginePropulsion) => string,
): string {
  if (engine.position === "outboard" && engine.propulsion === "outboard") {
    return propulsionLabel("outboard");
  }
  return `${positionLabel(engine.position)} · ${propulsionLabel(engine.propulsion)}`;
}
