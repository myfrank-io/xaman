"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MinusIcon, PackageCheckIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import type { StockItem } from "@/components/parts/StockList";
import { Button } from "@/components/ui/button";
import { adjustPartQuantity } from "@/lib/actions/parts";
import { formatNumber } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { isLowStock } from "@/lib/parts";

/** Neutral grey when a line has no system: a category colour never travels alone (rule 12). */
const NO_CATEGORY_COLOR = "#8A99AC";

/**
 * « À racheter » (D63): the spare parts at or under their threshold, as a checklist to
 * work through before the next outing. It is a *view* of the stock — the same rows the stock
 * list, the +/− and the sheet write — so there is never a second list to keep up to date
 * (JAMAIS de double saisie).
 *
 * The action is on the line itself (D63): + / − add or remove stock right here, and a line that
 * climbs back above its threshold leaves the list on its own. The row no longer navigates —
 * tapping the name did nothing but bounce to Bateau, which is exactly what was reported. Full
 * edits (seuil, emplacement, fournisseur) still live on the part's sheet, reached from the
 * stock under Bateau.
 */
export function RestockChecklist({
  boatId,
  parts,
  canWrite,
}: {
  boatId: string;
  /** The low lines only — the callers filter and hide the block when empty. */
  parts: StockItem[];
  canWrite: boolean;
}) {
  const t = useTranslations("restock");
  const ts = useTranslations("equipment.stock");
  const tu = useTranslations("equipment.stock.units");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Optimistic quantities: the tap shows at once, the database has the last word on refresh.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Lines that climbed back above their threshold: gone from the list before the refresh lands.
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const unitLabel = (unit: string) => (tu.has(unit as "pc") ? tu(unit as "pc") : unit);
  const quantityOf = (part: StockItem) => quantities[part.id] ?? part.quantity;
  const remaining = parts.filter((part) => !cleared.has(part.id));

  function adjust(part: StockItem, delta: number) {
    const current = quantityOf(part);
    const next = Math.max(0, current + delta);
    if (next === current) return;
    const stillLow = isLowStock({ quantity: next, minQuantity: part.minQuantity });
    setQuantities((all) => ({ ...all, [part.id]: next }));
    if (!stillLow) setCleared((all) => new Set(all).add(part.id));
    setBusy(part.id);
    startTransition(async () => {
      const result = await adjustPartQuantity({ boatId, partId: part.id, delta });
      setBusy(null);
      if (!result.ok) {
        setQuantities((all) => ({ ...all, [part.id]: current }));
        setCleared((all) => {
          const nextSet = new Set(all);
          nextSet.delete(part.id);
          return nextSet;
        });
        toast.error(errorMessage(result.error));
        return;
      }
      setQuantities((all) => ({ ...all, [part.id]: result.data.quantity }));
      router.refresh();
    });
  }

  if (remaining.length === 0) {
    return (
      <EmptyState variant="positive" icon={<PackageCheckIcon aria-hidden />} title={t("empty")} />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {remaining.map((part) => {
        const quantity = quantityOf(part);
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
                    ? ts("threshold", { min: formatNumber(part.minQuantity) })
                    : ts("noThreshold")}
                </span>
                {part.supplierName ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{t("supplier", { name: part.supplierName })}</span>
                  </>
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
                    aria-label={ts("decrement", { name: part.name })}
                    disabled={working || quantity <= 0}
                    onClick={() => adjust(part, -1)}
                  >
                    <MinusIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={ts("increment", { name: part.name })}
                    disabled={working}
                    onClick={() => adjust(part, 1)}
                  >
                    <PlusIcon />
                  </Button>
                </div>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
