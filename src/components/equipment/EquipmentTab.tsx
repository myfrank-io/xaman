"use client";

import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { PackageIcon } from "lucide-react";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { SectionCard } from "@/components/common/SectionCard";
import { RestockChecklist } from "@/components/parts/RestockChecklist";
import { StockList, type StockItem } from "@/components/parts/StockList";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { StockFilter } from "@/lib/parts";
import { equipmentPath, importPath, newEquipmentPath } from "@/lib/queries/boat-routes";

export type EquipmentSummary = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  quantity: number;
  categoryId: string | null;
  installedAt: string | null;
  removedAt: string | null;
};

export type CategorySummary = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
};

/** Everything the stock section needs, read by the page and handed down as plain props. */
export type StockData = {
  parts: StockItem[];
  /** The low lines, whatever the list filter: the « À racheter » checklist (D61). */
  lowParts: StockItem[];
  filter: StockFilter;
  lowCount: number;
  totalCount: number;
};

const STOCK_KEY = "__stock";

function meta(item: EquipmentSummary, quantityLabel: (count: number) => string): string {
  const parts = [item.brand, item.model].filter(Boolean) as string[];
  if (item.quantity > 1) parts.push(quantityLabel(item.quantity));
  return parts.join(" · ");
}

/**
 * Équipements (E2-3, D34): what the boat carries. One accordion per category, plus the
 * spare-parts stock as a section of its own — an inventory of things aboard belongs here,
 * next to the equipment, not under Dépenses which holds money only.
 *
 * Every section starts **closed** (D36): thirty-six pieces of equipment used to open as one
 * long scroll; closed, the whole inventory fits on one screen and opening one is a deliberate
 * act. Nothing is remembered between visits — the screen always looks the same on arrival —
 * and a single section opens by itself, since there is then nothing to choose between.
 */
export function EquipmentTab({
  boatId,
  items,
  categories,
  stock,
  canWrite,
}: {
  boatId: string;
  items: EquipmentSummary[];
  categories: CategorySummary[];
  stock: StockData;
  canWrite: boolean;
}) {
  const t = useTranslations("equipment");
  const ti = useTranslations("import");
  const tr = useTranslations("restock");
  const active = items.filter((item) => !item.removedAt);
  const removed = items.filter((item) => item.removedAt);
  const quantityLabel = (count: number) => t("quantityShort", { count });

  const groups = categories
    .map((category) => ({
      key: category.id,
      name: category.name,
      color: category.color as string | null,
      items: active.filter((item) => item.categoryId === category.id),
    }))
    .filter((group) => group.items.length > 0);
  const knownIds = new Set(categories.map((category) => category.id));
  const uncategorized = active.filter((item) => !item.categoryId || !knownIds.has(item.categoryId));
  if (uncategorized.length > 0) {
    groups.push({ key: "none", name: t("uncategorized"), color: null, items: uncategorized });
  }

  // The stock is one more section, always last: the equipment is the answer to « qu'y a-t-il
  // à bord », the spares are the answer to « qu'ai-je en réserve ».
  const sectionCount = groups.length + 1;
  const openByDefault = sectionCount === 1 ? [groups[0]?.key ?? STOCK_KEY] : [];
  const empty = groups.length === 0 && stock.totalCount === 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* « À racheter » first, when there is anything to buy back (D61): the parts at or under
          their threshold, as a checklist to tick off before the next outing. Derived from the
          same stock shown below — one source of truth, never a second entry. */}
      {stock.lowParts.length > 0 ? (
        <SectionCard
          title={tr("title")}
          action={
            <span className="text-caption text-ink-2">
              {tr("count", { count: stock.lowParts.length })}
            </span>
          }
          footer={tr("subtitle")}
          bare
        >
          <RestockChecklist boatId={boatId} parts={stock.lowParts} canWrite={canWrite} />
        </SectionCard>
      ) : null}

      {/* Same treatment as the engines: the toolbar led the list and cost the fold. */}
      <div className="order-last flex flex-wrap items-center justify-between gap-3 sm:order-none">
        {/* « 7 équipements · 5 pièces de rechange » repeats the tab badge 24 px above it and
            the « Pièces détachées 5 » row below it, and it was what pushed the two buttons onto
            a second line. */}
        <p className="hidden text-body text-ink-2 sm:block">
          {t("count", { count: active.length })}
          {stock.totalCount > 0 ? (
            <>
              {" · "}
              {t("stockCount", { count: stock.totalCount })}
            </>
          ) : null}
        </p>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={importPath(boatId, "equipment") as Route}>{ti("action")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={newEquipmentPath(boatId) as Route}>{t("add")}</Link>
            </Button>
          </div>
        ) : null}
      </div>

      {empty ? (
        <EmptyState
          icon={<PackageIcon />}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            canWrite ? (
              <Button asChild>
                <Link href={newEquipmentPath(boatId) as Route}>{t("add")}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Accordion
          type="multiple"
          defaultValue={openByDefault}
          className="rounded-xl border border-border bg-surface px-4"
        >
          {groups.map((group) => (
            <AccordionItem key={group.key} value={group.key}>
              <AccordionTrigger>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {group.color ? <CategoryDot color={group.color} /> : null}
                  <span className="min-w-0 truncate">{group.name}</span>
                  <span className="num text-caption font-medium text-ink-3">
                    {group.items.length}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="-mx-4">
                {group.items.map((item) => (
                  <ListRow
                    key={item.id}
                    title={item.name}
                    meta={meta(item, quantityLabel) || undefined}
                    href={equipmentPath(boatId, item.id)}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
          <AccordionItem value={STOCK_KEY}>
            <AccordionTrigger>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <PackageIcon className="size-4 shrink-0 text-ink-2" aria-hidden />
                <span className="min-w-0 truncate">{t("stockSection")}</span>
                <span className="num text-caption font-medium text-ink-3">{stock.totalCount}</span>
                {/* Visible on the closed row: « sous le seuil » means « à racheter ». */}
                {stock.lowCount > 0 ? (
                  <Badge
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-state-overdue-border bg-state-overdue-tint text-state-overdue-fg"
                  >
                    {t("stockLow", { count: stock.lowCount })}
                  </Badge>
                ) : null}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <StockList
                boatId={boatId}
                parts={stock.parts}
                canWrite={canWrite}
                filter={stock.filter}
                lowCount={stock.lowCount}
                totalCount={stock.totalCount}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {removed.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          className="rounded-xl border border-border bg-surface-2 px-4"
        >
          <AccordionItem value="removed">
            <AccordionTrigger className="text-body text-ink-2">
              {t("removedSection", { count: removed.length })}
            </AccordionTrigger>
            <AccordionContent className="-mx-4">
              {removed.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.name}
                  meta={t("removedOn", { date: formatDate(item.removedAt) })}
                  href={equipmentPath(boatId, item.id)}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
