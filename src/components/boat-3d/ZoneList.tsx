"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { ChevronRightIcon, PackageIcon } from "lucide-react";

import { ChecklistStateBadge } from "@/components/common/ChecklistStateBadge";
import { DueLabel } from "@/components/common/DueLabel";
import { ZONE_LABELS } from "@/components/boat-3d/zone-labels";
import type { ZoneSummary } from "@/lib/boat-3d/summary";
import type { ZoneKey } from "@/lib/boat-3d/zones";
import { categoryPath, equipmentPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

/**
 * The same boat, in words. Every zone of the model has a row here — including the ones in
 * order, which carry no pin — so nothing on the model is reachable only by aiming at it: the
 * list is the keyboard, screen-reader and « I cannot hit that » path to the same content.
 */
export function ZoneList({
  boatId,
  zones,
  selected,
  onSelect,
}: {
  boatId: string;
  zones: readonly ZoneSummary[];
  selected: ZoneKey | null;
  onSelect: (zone: ZoneKey | null) => void;
}) {
  const t = useTranslations("boat3d");
  const rowsRef = React.useRef(new Map<string, HTMLDivElement>());

  // A tap on the model has to be answered in the list too, and the row may be off screen.
  React.useEffect(() => {
    if (!selected) return;
    rowsRef.current.get(selected)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* Said once, above the rows, because the hint under the model is off screen by the time
          anyone reaches the list. */}
      <p className="sticky top-0 z-10 border-b border-border bg-surface-2 px-4 py-2 text-caption text-ink-2">
        {t("listHint")}
      </p>
      <div className="divide-y divide-border">
        {zones.map((zone) => {
          const open = zone.key === selected;
          const name = zone.name ?? t(ZONE_LABELS[zone.labelKey ?? "hulls"]);
          return (
            <div
              key={zone.key}
              ref={(element) => {
                if (element) rowsRef.current.set(zone.key, element);
                else rowsRef.current.delete(zone.key);
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(open ? null : zone.key)}
                aria-expanded={open}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 tap-feedback px-4 py-2 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:-outline-offset-2 focus-visible:outline-none",
                  open && "bg-accent/50",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{name}</span>
                  <span className="block truncate text-caption text-ink-3">{meta(zone, t)}</span>
                </span>
                {zone.state === "overdue" || zone.state === "soon" ? (
                  <ChecklistStateBadge state={zone.state} size="sm" />
                ) : null}
                <ChevronRightIcon
                  className={cn(
                    "size-5 shrink-0 text-ink-2 transition-transform",
                    open && "rotate-90",
                  )}
                  aria-hidden
                />
              </button>

              {open ? (
                <div className="flex flex-col gap-4 border-t border-border bg-surface-sunken px-4 py-3">
                  <Section title={t("todo")}>
                    {zone.points.length === 0 ? (
                      <p className="text-caption text-ink-3">{t("nothingDue")}</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {zone.points.map((point) => (
                          <li key={point.id}>
                            <Link
                              href={
                                (point.categoryId
                                  ? categoryPath(boatId, point.categoryId)
                                  : "#") as Route
                              }
                              className="flex min-h-11 items-center gap-2 rounded-lg tap-feedback px-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                            >
                              <ChecklistStateBadge state={point.state} size="sm" />
                              <span className="min-w-0 flex-1 truncate text-label">
                                {point.label}
                              </span>
                              <DueLabel
                                status={point.state}
                                daysRemaining={point.daysRemaining}
                                hoursRemaining={point.hoursRemaining}
                                hasCounter={point.hasCounter}
                                compact
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section title={t("aboard")}>
                    {zone.things.length === 0 ? (
                      <p className="text-caption text-ink-3">{t("noEquipment")}</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {zone.things.map((thing) => (
                          <li key={thing.id}>
                            <Link
                              href={equipmentPath(boatId, thing.id) as Route}
                              className="flex min-h-11 items-center gap-2 rounded-lg tap-feedback px-1 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                            >
                              <PackageIcon className="size-4 shrink-0 text-ink-3" aria-hidden />
                              <span className="min-w-0 flex-1 truncate text-label">
                                {thing.name}
                              </span>
                              {thing.meta ? (
                                <span className="shrink-0 truncate text-caption text-ink-3">
                                  {thing.meta}
                                </span>
                              ) : null}
                              <ChevronRightIcon
                                className="size-4 shrink-0 text-ink-3"
                                aria-hidden
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * « 3 équipements · 2 points de suivi », and « Rien de noté ici » when there is neither. Counting
 * zeroes out loud on eleven rows is what made the list read as a form with nothing in it.
 */
function meta(zone: ZoneSummary, t: ReturnType<typeof useTranslations<"boat3d">>): string {
  const parts: string[] = [];
  if (zone.things.length > 0) parts.push(t("rowMetaThings", { count: zone.things.length }));
  if (zone.points.length > 0) parts.push(t("rowMetaPoints", { count: zone.points.length }));
  return parts.length > 0 ? parts.join(" · ") : t("rowMetaEmpty");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-overline text-ink-2 uppercase">{title}</h3>
      {children}
    </section>
  );
}
