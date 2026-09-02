"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CheckIcon, SearchIcon, ShoppingBasketIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { markPurchaseReviewed } from "@/lib/actions/purchases";
import { formatCurrency, formatDate } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { editPurchasePath, newPurchasePath, suppliesPath } from "@/lib/queries/boat-routes";
import { purchaseKindLabelKey, type PurchaseKind } from "@/lib/schemas/purchases";

export type PurchaseListItem = {
  id: string;
  purchasedAt: string;
  designation: string;
  kind: PurchaseKind;
  amount: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  supplier: string | null;
  needsReview: boolean;
};

/**
 * Purchases list (E5-2): date, designation, kind, category (dot + name, never the colour
 * alone), amount, supplier and the amber « À vérifier » badge on an imported line.
 * Paging is a link, not an infinite scroll: the position stays in the URL.
 */
export function PurchaseList({
  boatId,
  purchases,
  canWrite,
  filtered,
  moreHref,
}: {
  boatId: string;
  purchases: PurchaseListItem[];
  canWrite: boolean;
  filtered: boolean;
  /** Next page, or null when everything is on screen. */
  moreHref: string | null;
}) {
  const t = useTranslations("supplies.purchases");
  const tk = useTranslations("purchaseKind");
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
      toast.success(t("review.done"));
      router.refresh();
    });
  }

  if (purchases.length === 0) {
    return (
      <EmptyState
        variant={filtered ? "filtered" : "initial"}
        icon={filtered ? <SearchIcon aria-hidden /> : <ShoppingBasketIcon aria-hidden />}
        title={filtered ? t("emptyFiltered") : t("emptyTitle")}
        description={filtered ? undefined : t("emptyDescription")}
        // Filtered: the way out, never the creation button (ux-flows §5.1).
        action={
          filtered ? (
            <Button asChild variant="outline">
              <Link href={suppliesPath(boatId, "purchases") as Route}>{t("clearFilters")}</Link>
            </Button>
          ) : canWrite ? (
            <Button asChild>
              <Link href={newPurchasePath(boatId) as Route}>{t("new")}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {purchases.map((purchase) => (
          <ListRow
            key={purchase.id}
            size="lg"
            categoryColor={purchase.categoryColor ?? undefined}
            lead={
              <span className="w-20 shrink-0 num text-caption text-ink-2">
                {formatDate(purchase.purchasedAt)}
              </span>
            }
            title={purchase.designation}
            meta={
              <>
                <span className="shrink-0">{tk(purchaseKindLabelKey(purchase.kind))}</span>
                {purchase.categoryName ? (
                  <>
                    <span aria-hidden>·</span>
                    <CategoryDot color={purchase.categoryColor ?? "#8A99AC"} />
                    <span className="truncate">{purchase.categoryName}</span>
                  </>
                ) : null}
                <span aria-hidden>·</span>
                <span className="truncate">{purchase.supplier ?? t("noSupplier")}</span>
                {purchase.needsReview ? (
                  // Amber tint, not a solid fill: it flags a doubt, it does not demand an action.
                  <Badge
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-state-soon-border bg-state-soon-tint text-state-soon-fg"
                  >
                    {t("review.badge")}
                  </Badge>
                ) : null}
              </>
            }
            trailing={
              <span className="num text-num-sm font-medium">{formatCurrency(purchase.amount)}</span>
            }
            action={
              purchase.needsReview && canWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => review(purchase.id)}
                  disabled={pending && reviewing === purchase.id}
                  aria-busy={pending && reviewing === purchase.id}
                >
                  {pending && reviewing === purchase.id ? (
                    <Spinner className="size-4" />
                  ) : (
                    <CheckIcon />
                  )}
                  {t("review.short")}
                </Button>
              ) : undefined
            }
            href={canWrite ? editPurchasePath(boatId, purchase.id) : undefined}
          />
        ))}
      </div>
      {moreHref ? (
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline">
            <Link href={moreHref as Route} scroll={false}>
              {t("loadMore")}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
