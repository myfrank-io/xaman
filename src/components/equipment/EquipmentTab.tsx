"use client";

import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { PackageIcon } from "lucide-react";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { equipmentPath, newEquipmentPath } from "@/lib/queries/boat-routes";

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

function meta(item: EquipmentSummary, quantityLabel: (count: number) => string): string {
  const parts = [item.brand, item.model].filter(Boolean) as string[];
  if (item.quantity > 1) parts.push(quantityLabel(item.quantity));
  return parts.join(" · ");
}

// Equipment tab (E2-3): one accordion per category, rows lead to the equipment sheet.
export function EquipmentTab({
  boatId,
  items,
  categories,
  canWrite,
}: {
  boatId: string;
  items: EquipmentSummary[];
  categories: CategorySummary[];
  canWrite: boolean;
}) {
  const t = useTranslations("equipment");
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body text-ink-2">{t("count", { count: active.length })}</p>
        {canWrite ? (
          <Button asChild variant="outline">
            <Link href={newEquipmentPath(boatId) as Route}>{t("add")}</Link>
          </Button>
        ) : null}
      </div>
      {groups.length === 0 ? (
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
          defaultValue={groups.map((group) => group.key)}
          className="rounded-xl border border-border bg-surface px-4"
        >
          {groups.map((group) => (
            <AccordionItem key={group.key} value={group.key}>
              <AccordionTrigger>
                <span className="flex min-w-0 items-center gap-2">
                  {group.color ? <CategoryDot color={group.color} /> : null}
                  <span className="truncate">{group.name}</span>
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
