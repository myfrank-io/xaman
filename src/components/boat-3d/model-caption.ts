import type { BoatFeatures } from "@/lib/boat-3d/features";

/**
 * What the drawing owes to the carnet, in the order a sailor would say it. Shown under the
 * model: it is the difference between « voilà un catamaran » and « voilà **ce** bateau », and it
 * is what makes it worth loading the builder's document — every line adds one here.
 */
export type CaptionPart = { key: string; area?: number };

const MAX = 4;

export function modelCaption(features: BoatFeatures): CaptionPart[] {
  const parts: CaptionPart[] = [];
  if (features.mainsailArea !== null) parts.push({ key: "mainsail", area: features.mainsailArea });
  if (features.daggerboards) parts.push({ key: "daggerboards" });
  if (features.transomRudders) parts.push({ key: "transomRudders" });
  if (features.skirts) parts.push({ key: "skirts" });
  if (features.bowsprit) parts.push({ key: "bowsprit" });
  if (features.solar === "davits") parts.push({ key: "solarDavits" });
  if (features.solar === "roof") parts.push({ key: "solarRoof" });
  if (features.anchor || features.windlass) parts.push({ key: "anchor" });
  if (features.liferaft) parts.push({ key: "liferaft" });
  if (features.dome) parts.push({ key: "dome" });
  return parts.slice(0, MAX);
}
