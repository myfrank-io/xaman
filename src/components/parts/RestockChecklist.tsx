"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import type { StockItem } from "@/components/parts/StockList";
import { undoToast } from "@/components/common/UndoToast";
import { Checkbox } from "@/components/ui/checkbox";
import { adjustPartQuantity, restockPart } from "@/lib/actions/parts";
import { formatNumber } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { editPartPath } from "@/lib/queries/boat-routes";

/** Neutral grey when a line has no system: a category colour never travels alone (rule 12). */
const NO_CATEGORY_COLOR = "#8A99AC";

/**
 * « À racheter » (D61): the spare parts at or under their threshold, as a checklist to work
 * through before the next outing. It is a *view* of the stock — the same rows the stock list,
 * the +/− and the sheet write — so there is never a second list to keep up to date (JAMAIS de
 * double saisie). Ticking a line means « racheté et remis à bord »: the quantity climbs just
 * above the threshold and the line leaves the list, with an 8 s « Annuler » in case of a wet
 * tap. When nothing is low the whole block is hidden by its callers, so the positive empty
 * state here only shows if the last line was just ticked.
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
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Ticked lines vanish at once; the database has the last word on the next refresh.
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const unitLabel = (unit: string) => (tu.has(unit as "pc") ? tu(unit as "pc") : unit);
  const remaining = parts.filter((part) => !done.has(part.id));

  function markDone(part: StockItem) {
    setBusy(part.id);
    setDone((all) => new Set(all).add(part.id));
    startTransition(async () => {
      const result = await restockPart({ boatId, partId: part.id });
      setBusy(null);
      if (!result.ok) {
        setDone((all) => {
          const next = new Set(all);
          next.delete(part.id);
          return next;
        });
        toast.error(errorMessage(result.error));
        return;
      }
      // A stale line already back in stock: no change to undo, just let it drop off the list.
      if (result.data.delta > 0) {
        undoToast({
          message: t("done", { name: part.name }),
          undoLabel: tc("undo"),
          onUndo: () => {
            void adjustPartQuantity({ boatId, partId: part.id, delta: -result.data.delta }).then(
              (reverted) => {
                if (!reverted.ok) {
                  toast.error(errorMessage(reverted.error));
                  return;
                }
                setDone((all) => {
                  const next = new Set(all);
                  next.delete(part.id);
                  return next;
                });
                router.refresh();
              },
            );
          },
        });
      }
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
      {remaining.map((part) => (
        <ListRow
          key={part.id}
          size="lg"
          categoryColor={part.categoryColor ?? undefined}
          lead={
            <span className="w-20 shrink-0 text-right">
              <span className="num text-body font-semibold text-foreground">
                {formatNumber(part.quantity)}
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
              <Checkbox
                checked={false}
                disabled={busy === part.id}
                aria-label={t("check", { name: part.name })}
                onCheckedChange={(value) => {
                  if (value) markDone(part);
                }}
              />
            ) : undefined
          }
          href={canWrite ? editPartPath(boatId, part.id) : undefined}
        />
      ))}
    </div>
  );
}
