"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { MinusIcon, PackageIcon, PlusIcon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { adjustPartQuantity } from "@/lib/actions/parts";
import { formatNumber } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { isLowStock, monthsSinceCheck, STOCK_FILTERS, type StockFilter } from "@/lib/parts";
import { editPartPath, importPath, newPartPath, stockPath } from "@/lib/queries/boat-routes";

/** Neutral grey when a line has no system: a category colour never travels alone (rule 12). */
const NO_CATEGORY_COLOR = "#8A99AC";

export type StockItem = {
  id: string;
  name: string;
  reference: string | null;
  quantity: number;
  minQuantity: number;
  unit: string;
  location: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  supplierName: string | null;
  checkedAt: string | null;
};

/**
 * Stock of spare parts (E5-4, D10, D34): one flat list — quantity, name, system, place on
 * board, threshold, when it was last counted — with + / − on the line and « Sous le seuil » in
 * red because it means « à racheter ». It lives inside Bateau › Équipements: a spare part is a
 * thing aboard, not a cost. The filter lives in the URL like every other list.
 */
export function StockList({
  boatId,
  parts,
  canWrite,
  filter,
  lowCount,
  totalCount,
}: {
  boatId: string;
  parts: StockItem[];
  canWrite: boolean;
  filter: StockFilter;
  lowCount: number;
  totalCount: number;
}) {
  const t = useTranslations("equipment.stock");
  const ti = useTranslations("import");
  const tu = useTranslations("equipment.stock.units");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Optimistic quantities: the tap shows immediately, the database has the last word.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const quantityOf = (part: StockItem) => quantities[part.id] ?? part.quantity;
  const unitLabel = (unit: string) => (tu.has(unit as "pc") ? tu(unit as "pc") : unit);
  const checkedLabel = (checkedAt: string | null) => {
    const months = monthsSinceCheck(checkedAt);
    if (months === null) return t("checked.never");
    if (months === 0) return t("checked.thisMonth");
    return t("checked.monthsAgo", { count: months });
  };

  function adjust(part: StockItem, delta: number) {
    const current = quantityOf(part);
    const next = Math.max(0, current + delta);
    if (next === current) return;
    setQuantities((all) => ({ ...all, [part.id]: next }));
    setBusy(part.id);
    startTransition(async () => {
      const result = await adjustPartQuantity({ boatId, partId: part.id, delta });
      setBusy(null);
      if (!result.ok) {
        setQuantities((all) => ({ ...all, [part.id]: current }));
        toast.error(errorMessage(result.error));
        return;
      }
      setQuantities((all) => ({ ...all, [part.id]: result.data.quantity }));
      router.refresh();
    });
  }

  function setFilter(next: StockFilter) {
    router.replace(stockPath(boatId, { low: next === "low" ? 1 : undefined }) as Route);
  }

  const counts: Record<StockFilter, number> = { all: totalCount, low: lowCount };
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <ToggleGroup
        type="single"
        value={filter}
        aria-label={t("filters.label")}
        onValueChange={(value) => value && setFilter(value as StockFilter)}
      >
        {STOCK_FILTERS.map((option) => (
          <ToggleGroupItem key={option} value={option} className="min-h-11">
            {t(`filters.${option}`, { count: counts[option] })}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {canWrite ? (
        // Named buttons, not a second « + »: the screen's « + » creates a purchase (D19).
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={importPath(boatId, "parts") as Route}>
              <UploadIcon />
              {ti("action")}
            </Link>
          </Button>
          <Button asChild>
            <Link href={newPartPath(boatId) as Route}>
              <PlusIcon />
              {t("new")}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );

  if (totalCount === 0) {
    return (
      <EmptyState
        icon={<PackageIcon aria-hidden />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          canWrite ? (
            <Button asChild>
              <Link href={newPartPath(boatId) as Route}>
                <PlusIcon />
                {t("new")}
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      {parts.length === 0 ? (
        <EmptyState
          variant="positive"
          icon={<PackageIcon aria-hidden />}
          title={t("emptyFiltered")}
          action={
            <Button asChild variant="outline">
              <Link href={stockPath(boatId) as Route}>{t("showAll")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {parts.map((part) => {
            const quantity = quantityOf(part);
            const low = isLowStock({ quantity, minQuantity: part.minQuantity });
            const working = busy === part.id;
            return (
              <ListRow
                key={part.id}
                size="lg"
                categoryColor={part.categoryColor ?? undefined}
                lead={
                  <span className="w-20 shrink-0 text-right">
                    <span className="num text-body font-semibold text-foreground">
                      {formatNumber(quantity)}
                    </span>{" "}
                    <span className="text-caption text-ink-2">{unitLabel(part.unit)}</span>
                  </span>
                }
                title={
                  <>
                    {part.name}
                    {part.reference ? (
                      <span className="font-normal text-ink-3"> · {part.reference}</span>
                    ) : null}
                  </>
                }
                meta={
                  <>
                    {part.categoryName ? (
                      <>
                        <CategoryDot color={part.categoryColor ?? NO_CATEGORY_COLOR} />
                        <span className="truncate">{part.categoryName}</span>
                        <span aria-hidden>·</span>
                      </>
                    ) : null}
                    {part.location ? (
                      <>
                        <span className="truncate">{part.location}</span>
                        <span aria-hidden>·</span>
                      </>
                    ) : null}
                    <span className="shrink-0">
                      {part.minQuantity > 0
                        ? t("threshold", { min: formatNumber(part.minQuantity) })
                        : t("noThreshold")}
                    </span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">{checkedLabel(part.checkedAt)}</span>
                    {low ? (
                      <Badge
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-state-overdue-border bg-state-overdue-tint text-state-overdue-fg"
                      >
                        {t("low")}
                      </Badge>
                    ) : null}
                  </>
                }
                action={
                  canWrite ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("decrement", { name: part.name })}
                        disabled={working || quantity <= 0}
                        onClick={() => adjust(part, -1)}
                      >
                        <MinusIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("increment", { name: part.name })}
                        disabled={working}
                        onClick={() => adjust(part, 1)}
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                  ) : undefined
                }
                href={canWrite ? editPartPath(boatId, part.id) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
