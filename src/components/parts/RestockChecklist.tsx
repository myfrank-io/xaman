"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheckIcon, ShoppingCartIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { undoToast } from "@/components/common/UndoToast";
import { useOnline } from "@/components/common/use-online";
import { submitOrQueue } from "@/components/forms/submit-or-queue";
import { useOutbox } from "@/components/offline/use-outbox";
import type { StockItem } from "@/components/parts/StockList";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trashPurchase, upsertPurchase } from "@/lib/actions/purchases";
import { formatNumber, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { restockQuantity } from "@/lib/parts";

/** Neutral grey when a line has no system: a category colour never travels alone (rule 12). */
const NO_CATEGORY_COLOR = "#8A99AC";

/**
 * « À racheter » (D63, D143): the spare parts under their threshold, as a list to work through
 * before the next outing. It is a *view* of the stock — the same rows the stock list and the
 * sheet write — so there is never a second list to keep up to date (JAMAIS de double saisie).
 *
 * One button, one tap: **« Racheté »**. It writes the purchase the chandlery run produced — the
 * part's name, its system, its supplier, today, the units the line was short of — and the
 * database puts those units back in the locker (`apply_purchase_to_stock`, D143). The line leaves
 * the list, the confirmation **says what it assumed** — « 2 pc · chez Marsaudon · stock à 2 » —
 * and « Annuler » stays under the thumb for eight seconds: it moves the purchase to the trash,
 * and the stock goes back with it.
 *
 * What it replaces: a « + » tapped once per unit, and the same purchase typed again under
 * Dépenses. The price is the one thing a receipt knows and the gesture does not, so it is left
 * empty — « inconnu » is not « gratuit » — and filled from Dépenses when the receipt is at hand.
 * The + / − stay where one *counts* the stock, on the stock list under Bateau: here one buys.
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
  const ts = useTranslations("parts");
  const tu = useTranslations("parts.units");
  const to = useTranslations("offline");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const outbox = useOutbox(boatId);
  const { online } = useOnline();
  const [, startTransition] = useTransition();
  // Lines already bought: gone from the list before the refresh lands.
  const [bought, setBought] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const unitLabel = (unit: string) => (tu.has(unit as "pc") ? tu(unit as "pc") : unit);
  const remaining = parts.filter((part) => !bought.has(part.id));

  function forget(partId: string) {
    setBought((all) => {
      const next = new Set(all);
      next.delete(partId);
      return next;
    });
  }

  function buyBack(part: StockItem) {
    // The purchase's id, drawn here so a double tap — or a replay from the queue — writes one
    // row and not two (rule 11).
    const purchaseId = crypto.randomUUID();
    const quantity = restockQuantity(part);
    const stock = part.quantity + quantity;
    // The line goes at the speed of the finger; the database has the last word on refresh.
    setBought((all) => new Set(all).add(part.id));
    setBusy(part.id);

    startTransition(async () => {
      const outcome = await submitOrQueue({
        kind: "purchase",
        boatId,
        id: purchaseId,
        label: part.name,
        values: {
          id: purchaseId,
          boatId,
          kind: "part",
          designation: part.name,
          // The receipt's number, and the only thing this gesture cannot know.
          amount: null,
          purchasedAt: todayString(),
          supplierContactId: part.supplierContactId,
          supplierName: null,
          categoryId: part.categoryId,
          bottleType: null,
          maintenanceLogId: null,
          notes: null,
          needsReview: false,
          partId: part.id,
          quantity,
        },
        action: upsertPurchase,
        enqueue: outbox.enqueue,
        online,
        // Buying happens at the chandlery, where the boat's wifi is not.
        allowQueue: true,
      });
      setBusy(null);
      if (outcome.status === "full") {
        forget(part.id);
        toast.error(to("queueFull"));
        return;
      }
      if (outcome.status === "refused") {
        forget(part.id);
        toast.error(errorMessage(outcome.error));
        return;
      }

      const description = [
        t("boughtQuantity", { quantity: formatNumber(quantity), unit: unitLabel(part.unit) }),
        part.supplierName ? t("supplier", { name: part.supplierName }) : null,
        t("boughtStock", { quantity: formatNumber(stock), unit: unitLabel(part.unit) }),
      ]
        .filter(Boolean)
        .join(" · ");

      undoToast({
        message:
          outcome.status === "queued" ? to("savedOnDevice") : t("bought", { name: part.name }),
        description,
        undoLabel: t("undo"),
        onUndo: () => {
          if (outcome.status === "queued") {
            outbox.discard(purchaseId);
            forget(part.id);
            toast.success(t("undone"));
            return;
          }
          // Annuler, c'est mettre l'achat à la corbeille : les unités repartent avec lui, et la
          // corbeille garde trente jours ce qui aurait été un vrai geste (règle 9).
          void trashPurchase({ boatId, purchaseId }).then((undone) => {
            if (!undone.ok) {
              toast.error(errorMessage(undone.error));
              return;
            }
            forget(part.id);
            toast.success(t("undone"));
            router.refresh();
          });
        },
      });
      if (outcome.status !== "queued") router.refresh();
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
        const working = busy === part.id;
        return (
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
                  {ts("threshold", { min: formatNumber(part.minQuantity) })}
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
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t("buyBackLabel", { name: part.name })}
                  disabled={working}
                  aria-busy={working}
                  onClick={() => buyBack(part)}
                >
                  {working ? <Spinner className="size-4" /> : <ShoppingCartIcon />}
                  {t("buyBack")}
                </Button>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
