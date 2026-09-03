"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CheckIcon, EuroIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { markPurchaseReviewed } from "@/lib/actions/purchases";
import type { ExpenseSource } from "@/lib/expenses";
import { formatCurrency, formatDate } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import {
  editPurchasePath,
  haulOutPath,
  logPath,
  newPurchasePath,
  suppliesPath,
} from "@/lib/queries/boat-routes";

/** Neutral grey when a line has no system: a category colour never travels alone (rule 12). */
const NO_CATEGORY_COLOR = "#8A99AC";

export type ExpenseLine = {
  source: ExpenseSource;
  entityId: string;
  label: string;
  date: string;
  amount: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  /** Purchases only: the kind label, the supplier and the imported-line flag. */
  kindLabel: string | null;
  supplier: string | null;
  needsReview: boolean;
};

/**
 * The one money list of the app (D33): interventions, purchases and haul-outs in a single
 * ledger, newest first. Every line says what it paid for and links to it, so the link between
 * an intervention and its cost is visible from both sides.
 */
export function ExpenseLines({
  boatId,
  lines,
  canWrite,
  filtered,
  moreHref,
}: {
  boatId: string;
  lines: ExpenseLine[];
  canWrite: boolean;
  filtered: boolean;
  /** Next page, or null when everything is on screen. */
  moreHref: string | null;
}) {
  const t = useTranslations("supplies.expenses");
  const tp = useTranslations("supplies.purchases");
  const ts = useTranslations("supplies.expenses.sourceSingular");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reviewing, setReviewing] = useState<string | null>(null);

  function review(purchaseId: string) {
    setReviewing(purchaseId);
    startTransition(async () => {
      const result = await markPurchaseReviewed({ boatId, purchaseId });
      setReviewing(null);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(tp("review.done"));
      router.refresh();
    });
  }

  // Each line leads back to what it paid for; a purchase opens where it can be corrected.
  function targetOf(line: ExpenseLine): string | undefined {
    if (line.source === "log") return logPath(boatId, line.entityId);
    if (line.source === "haul_out") return haulOutPath(boatId, line.entityId);
    return canWrite ? editPurchasePath(boatId, line.entityId) : undefined;
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        variant={filtered ? "filtered" : "initial"}
        icon={filtered ? <SearchIcon aria-hidden /> : <EuroIcon aria-hidden />}
        title={filtered ? t("emptyFiltered") : t("emptyTitle")}
        description={filtered ? undefined : t("emptyDescription")}
        // Filtered: the way out, never the creation button (ux-flows §5.1).
        action={
          filtered ? (
            <Button asChild variant="outline">
              <Link href={suppliesPath(boatId) as Route}>{t("clearFilters")}</Link>
            </Button>
          ) : canWrite ? (
            <Button asChild>
              <Link href={newPurchasePath(boatId) as Route}>{tp("new")}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {lines.map((line) => (
          <ListRow
            key={`${line.source}-${line.entityId}`}
            size="lg"
            categoryColor={line.categoryColor ?? undefined}
            lead={
              <span className="w-20 shrink-0 num text-caption text-ink-2">
                {formatDate(line.date)}
              </span>
            }
            title={line.label}
            meta={
              <>
                {/* What this line paid for — the whole point of one merged list. */}
                <span className="shrink-0">{line.kindLabel ?? ts(line.source)}</span>
                {line.categoryName ? (
                  <>
                    <span aria-hidden>·</span>
                    <CategoryDot color={line.categoryColor ?? NO_CATEGORY_COLOR} />
                    <span className="truncate">{line.categoryName}</span>
                  </>
                ) : null}
                {line.supplier ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{line.supplier}</span>
                  </>
                ) : null}
                {line.needsReview ? (
                  // Amber tint, not a solid fill: it flags a doubt, it does not demand an action.
                  <Badge
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-state-soon-border bg-state-soon-tint text-state-soon-fg"
                  >
                    {tp("review.badge")}
                  </Badge>
                ) : null}
              </>
            }
            trailing={
              <span className="num text-num-sm font-medium">{formatCurrency(line.amount)}</span>
            }
            action={
              line.needsReview && canWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => review(line.entityId)}
                  disabled={pending && reviewing === line.entityId}
                  aria-busy={pending && reviewing === line.entityId}
                >
                  {pending && reviewing === line.entityId ? (
                    <Spinner className="size-4" />
                  ) : (
                    <CheckIcon />
                  )}
                  {tp("review.short")}
                </Button>
              ) : undefined
            }
            href={targetOf(line)}
          />
        ))}
      </div>
      {moreHref ? (
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline">
            <Link href={moreHref as Route} scroll={false}>
              {tp("loadMore")}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
