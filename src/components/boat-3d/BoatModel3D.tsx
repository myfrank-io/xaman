"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { ModelCanvas } from "@/components/boat-3d/ModelCanvas";
import { modelCaption } from "@/components/boat-3d/model-caption";
import { ZoneList } from "@/components/boat-3d/ZoneList";
import { SectionCard } from "@/components/common/SectionCard";
import { readFeatures } from "@/lib/boat-3d/features";
import { buildBoatMesh, type BoatShape } from "@/lib/boat-3d/model";
import { buildZoneSummaries, type SummaryInput } from "@/lib/boat-3d/summary";
import type { ZoneKey } from "@/lib/boat-3d/zones";

export type BoatModelData = Omit<SummaryInput, "mesh" | "hasKeel"> & {
  shape: BoatShape;
};

/**
 * « Le bateau en 3D » (E2-8, D117): the boat itself as the way in to what is aboard and what is
 * due on it. The model is turned by a finger or turns on its own; every place of it is a target,
 * and the list beside it carries the same places for anyone who would rather read than aim.
 *
 * The mesh is built in the browser from four figures (type, length, beam, draft) and the boat's
 * engines — nothing is downloaded, and a boat whose dimensions are unknown still gets a boat of
 * its own type rather than an empty frame.
 */
export function BoatModel3D({
  boatId,
  boatName,
  data,
}: {
  boatId: string;
  boatName: string;
  data: BoatModelData;
}) {
  const t = useTranslations("boat3d");
  const [selected, setSelected] = React.useState<ZoneKey | null>(null);

  // The hull is drawn from the carnet: its dimensions, its engines, and what its inventory says
  // it carries. An equipment added today changes the drawing today.
  const features = React.useMemo(() => readFeatures(data.equipment), [data.equipment]);
  const mesh = React.useMemo(
    () => buildBoatMesh({ ...data.shape, features }),
    [data.shape, features],
  );
  const zones = React.useMemo(
    () =>
      buildZoneSummaries({
        mesh,
        hasKeel: data.shape.type === "monohull_sail",
        categories: data.categories,
        equipment: data.equipment,
        points: data.points,
        engines: data.engines,
      }),
    [mesh, data],
  );

  const overdue = zones.reduce((total, zone) => total + zone.overdue, 0);
  const soon = zones.reduce((total, zone) => total + zone.soon, 0);

  // What the drawing owes to the carnet, named. Without it the model is « a catamaran »; with
  // it, it is this boat — and it says plainly what loading one more document would add.
  const caption = modelCaption(features);
  const details = caption
    .map((part) => t(`detail.${part.key}` as "detail.daggerboards", { area: part.area ?? 0 }))
    .join(" · ");

  return (
    <SectionCard
      title={t("title")}
      action={
        <span className="text-caption text-ink-2">
          {overdue > 0
            ? t("headlineOverdue", { count: overdue })
            : soon > 0
              ? t("headlineSoon", { count: soon })
              : // Nothing due: say what is aboard rather than « rien ». The maquette is how an
                // owner learns his boat, and « rien en retard » teaches nothing about it.
                t("headlineAboard", { count: data.equipment.length })}
        </span>
      }
      bare
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <ModelCanvas
          mesh={mesh}
          zones={zones}
          selected={selected}
          onSelect={setSelected}
          boatName={boatName}
          caption={caption.length > 0 ? t("fromCarnet", { details }) : t("fromCarnetEmpty")}
        />
        {/* Tall lists are capped rather than allowed to push the inventory below the fold: the
            model and its list must fit the iPad screen together. */}
        <div className="max-h-[26rem] overflow-y-auto overscroll-contain lg:max-h-[31rem]">
          <ZoneList boatId={boatId} zones={zones} selected={selected} onSelect={setSelected} />
        </div>
      </div>
    </SectionCard>
  );
}
