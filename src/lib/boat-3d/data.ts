import type { BoatModelData } from "@/components/boat-3d/BoatModel3D";
import type { ChecklistState } from "@/components/common/ChecklistStateBadge";
import type { Database } from "@/types/database";

/** `equipment.specs` is jsonb: anything could be in there, so only a plain object survives. */
export function specsRecord(specs: unknown): Record<string, unknown> | null {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return null;
  return specs as Record<string, unknown>;
}

/** Ce que la maquette lit du bateau, table par table — les colonnes, et pas une de plus. */
export type BoatModelInput = {
  boat: Pick<
    Database["public"]["Tables"]["boats"]["Row"],
    "type" | "length_m" | "beam_m" | "draft_m"
  >;
  engines: readonly {
    id: string;
    position: Database["public"]["Enums"]["engine_position"];
    is_active: boolean;
    label: string;
  }[];
  categories: readonly { id: string; external_ref: string | null }[];
  equipment: readonly {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    quantity: number;
    category_id: string | null;
    external_ref: string | null;
    removed_at: string | null;
    specs: unknown;
  }[];
  points: readonly {
    id: string | null;
    label: string | null;
    status: string | null;
    days_remaining: number | null;
    hours_remaining: number | null;
    engine_tracks_hours: boolean | null;
    category_id: string | null;
    engine_id: string | null;
  }[];
};

/**
 * Les lignes du carnet, telles que la maquette 3D les veut (E2-8, D117).
 *
 * Pure, et partagée par les deux écrans qui montrent le bateau : l'onglet Bateau, qui lit déjà
 * ces lignes pour ses listes, et « À bord », qui les lit pour ce seul bloc (E18-13). Deux
 * assemblages auraient fini par dessiner deux bateaux différents du même carnet.
 *
 * Un équipement déposé (`removed_at`) ne se dessine plus : la maquette montre ce qui est à bord
 * aujourd'hui, pas ce qui y a été.
 */
export function toBoatModelData(input: BoatModelInput): BoatModelData {
  return {
    shape: {
      type: input.boat.type,
      lengthM: input.boat.length_m,
      beamM: input.boat.beam_m,
      draftM: input.boat.draft_m,
      engines: input.engines
        .filter((engine) => engine.is_active)
        .map((engine) => ({ id: engine.id, position: engine.position })),
    },
    categories: input.categories.map((category) => ({
      id: category.id,
      externalRef: category.external_ref,
    })),
    equipment: input.equipment
      .filter((item) => !item.removed_at)
      .map((item) => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        model: item.model,
        quantity: item.quantity,
        categoryId: item.category_id,
        externalRef: item.external_ref,
        // `specs` dit à la maquette que ce bateau porte 88 m² de grand-voile et ses panneaux sur
        // les bossoirs : des paires libres, lues comme du texte, jamais tenues pour une forme.
        specs: specsRecord(item.specs),
      })),
    points: input.points.map((row) => ({
      id: row.id ?? "",
      label: row.label ?? "",
      state: (row.status ?? "never") as ChecklistState,
      daysRemaining: row.days_remaining,
      hoursRemaining: row.hours_remaining,
      hasCounter: row.engine_tracks_hours ?? true,
      categoryId: row.category_id,
      engineId: row.engine_id,
    })),
    engines: input.engines.map((engine) => ({ id: engine.id, label: engine.label })),
  };
}
