import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { UploadIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { ExpensesTab, type ExpensesData } from "@/components/supplies/ExpensesTab";
import type { ExpenseLine } from "@/components/supplies/ExpenseLines";
import { GasBottleEntry } from "@/components/supplies/GasBottleEntry";
import { GasFacts } from "@/components/supplies/GasFacts";
import {
  isExpensePeriod,
  parseSources,
  previousRange,
  resolveRange,
  type ExpenseRow,
  type ExpenseSource,
} from "@/lib/expenses";
import { gasFacts } from "@/lib/gas";
import { can, type BoatRole } from "@/lib/permissions";
import { isPurchaseKind, parsePurchaseLimit, PURCHASE_PAGE_SIZE } from "@/lib/purchases";
import { importPath, stockPath, suppliesPath } from "@/lib/queries/boat-routes";
import { purchaseKindLabelKey, type PurchaseKind } from "@/lib/schemas/purchases";
import { createClient } from "@/lib/supabase/server";

/** Category of the gas bottle in the ORC 50 seed, used when no gas line exists yet. */
const GAS_CATEGORY_REF = "plumbing_systems";

type SearchParams = {
  tab?: string;
  kind?: string;
  category?: string;
  period?: string;
  from?: string;
  to?: string;
  source?: string;
  limit?: string;
  low?: string;
};

/**
 * Dépenses (E5-1, D33): money only, and **one** list — the cost of an intervention, a
 * purchase, a haul-out, each line pointing at what it paid for. « Achats » is no longer a
 * separate view: a purchase IS an expense. Gas is not a tab either but the bottle shortcut
 * (`?tab=gas`), which is where the app's « + » sheet lands. The spare-parts stock left this
 * screen for Bateau › Équipements (D34): it is an inventory of things, not a cost.
 */
export default async function SuppliesPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ boatId }, query] = await Promise.all([params, searchParams]);

  // Links already sent, and any installed PWA, still carry the old tabs.
  if (query.tab === "stock") {
    redirect(stockPath(boatId, { low: query.low === "1" ? 1 : undefined }) as Route);
  }
  if (query.tab === "purchases" || query.tab === "expenses") {
    redirect(
      suppliesPath(boatId, undefined, {
        kind: query.kind,
        category: query.category,
        period: query.period,
        from: query.from,
        to: query.to,
        source: query.source,
      }) as Route,
    );
  }

  const supabase = await createClient();
  const [{ data: role }, { data: categories }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon, external_ref")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  if (!role) notFound();
  const canWrite = can(role as BoatRole, "write");
  const categoryList = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));

  // `?tab=gas` is the « + » sheet entry: the same list filtered on gas, dialog open.
  const gasEntry = query.tab === "gas";
  const kind = gasEntry ? "gas" : isPurchaseKind(query.kind) ? query.kind : null;
  // « Toute la période » by default: a twelve-month window would hide the paper logbook.
  const period = isExpensePeriod(query.period) ? query.period : "all";
  const range = resolveRange(period, { from: query.from, to: query.to });
  // A kind only exists on a purchase; picking one implies that source.
  const sources: ExpenseSource[] = kind ? ["purchase"] : parseSources(query.source);
  const categoryId = query.category ?? null;
  const limit = parsePurchaseLimit(query.limit);
  const previous = previousRange(period, range);

  let listQuery = supabase
    .from("expenses_by_category")
    .select(
      "source, purchase_kind, entity_id, label, amount, date, category_id, category_name, category_color",
    )
    .eq("boat_id", boatId)
    .gte("date", range.from)
    .lte("date", range.to)
    .in("source", sources);
  if (kind) listQuery = listQuery.eq("purchase_kind", kind);
  if (categoryId) listQuery = listQuery.eq("category_id", categoryId);

  const [{ data: rows }, { data: history }, { data: contacts }, { data: gasRows }] =
    await Promise.all([
      listQuery.order("date", { ascending: false }),
      // Light query (two columns) feeding both the comparison and the running total.
      supabase
        .from("expenses_by_category")
        .select("amount, date")
        .eq("boat_id", boatId)
        .in("source", sources)
        .order("date", { ascending: true }),
      supabase
        .from("contacts")
        .select("id, name, specialty, company, phone")
        .eq("boat_id", boatId)
        .order("name"),
      kind === "gas" || gasEntry
        ? supabase
            .from("purchases")
            .select(
              "purchased_at, amount, bottle_type, supplier_contact_id, supplier_name, category_id",
            )
            .eq("boat_id", boatId)
            .eq("kind", "gas")
            .is("deleted_at", null)
            .order("purchased_at", { ascending: false })
        : Promise.resolve({ data: null }),
    ]);

  const all = history ?? [];
  const previousTotal =
    period === "all"
      ? 0
      : all
          .filter((row) => (row.date ?? "") >= previous.from && (row.date ?? "") <= previous.to)
          .reduce((sum, row) => sum + (row.amount ?? 0), 0);

  const expenseRows: ExpenseRow[] = (rows ?? []).map((row) => ({
    source: row.source,
    purchaseKind: row.purchase_kind,
    entityId: row.entity_id,
    label: row.label,
    amount: row.amount,
    date: row.date,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryColor: row.category_color,
  }));

  // The view carries neither the supplier nor the imported-line flag: one extra read, keyed
  // by the purchase ids of the page, keeps both visible in the merged list.
  const page = expenseRows.slice(0, limit);
  const purchaseIds = page
    .filter((row) => row.source === "purchase")
    .map((row) => row.entityId)
    .filter((id): id is string => Boolean(id));
  const { data: purchaseExtras } = purchaseIds.length
    ? await supabase
        .from("purchases")
        .select("id, supplier_contact_id, supplier_name, needs_review")
        .in("id", purchaseIds)
    : { data: null };
  const contactNames = new Map((contacts ?? []).map((contact) => [contact.id, contact.name]));
  const extras = new Map((purchaseExtras ?? []).map((row) => [row.id, row]));

  const [t, tk, ti] = await Promise.all([
    getTranslations("supplies"),
    getTranslations("purchaseKind"),
    getTranslations("import"),
  ]);

  const lines: ExpenseLine[] = page.map((row) => {
    const extra = row.entityId ? extras.get(row.entityId) : undefined;
    return {
      source: (row.source ?? "purchase") as ExpenseSource,
      entityId: row.entityId ?? "",
      label: row.label ?? "",
      date: row.date ?? "",
      amount: row.amount,
      categoryName: row.categoryName,
      categoryColor: row.categoryColor,
      kindLabel: row.purchaseKind
        ? tk(purchaseKindLabelKey(row.purchaseKind as PurchaseKind))
        : null,
      supplier: extra
        ? extra.supplier_contact_id
          ? (contactNames.get(extra.supplier_contact_id) ?? null)
          : extra.supplier_name
        : null,
      needsReview: extra?.needs_review ?? false,
    };
  });

  const moreHref =
    expenseRows.length > limit
      ? suppliesPath(boatId, undefined, {
          kind: kind ?? undefined,
          category: categoryId ?? undefined,
          period: period === "all" ? undefined : period,
          from: period === "custom" ? range.from : undefined,
          to: period === "custom" ? range.to : undefined,
          source: kind ? undefined : query.source,
          limit: limit + PURCHASE_PAGE_SIZE,
        })
      : null;

  const data: ExpensesData = {
    rows: expenseRows,
    lines,
    previousTotal,
    cumulativeTotal: all.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    firstDate: all[0]?.date ?? null,
    moreHref,
  };

  const gas = gasRows ?? [];
  const facts = gasFacts(gas.map((row) => row.purchased_at));
  const last = gas[0];
  const gasDefaults = {
    bottleTypes: [
      ...new Set(gas.map((row) => row.bottle_type).filter((type): type is string => Boolean(type))),
    ],
    bottleType: last?.bottle_type ?? null,
    supplierContactId: last?.supplier_contact_id ?? null,
    supplierName: last?.supplier_name ?? null,
    categoryId:
      last?.category_id ??
      (categories ?? []).find((category) => category.external_ref === GAS_CATEGORY_REF)?.id ??
      null,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("expenses.subtitle")}
        actions={
          canWrite ? (
            <Button asChild variant="outline">
              <Link href={importPath(boatId, "purchases") as Route}>
                <UploadIcon />
                {ti("action")}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {kind === "gas" ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <GasFacts facts={facts} total={gas.reduce((sum, row) => sum + (row.amount ?? 0), 0)} />
          </div>
          {canWrite ? (
            <GasBottleEntry
              boatId={boatId}
              contacts={contacts ?? []}
              defaults={gasDefaults}
              facts={facts}
              defaultOpen={gasEntry}
            />
          ) : null}
        </div>
      ) : null}
      <ExpensesTab
        boatId={boatId}
        period={period}
        range={range}
        sources={sources}
        kind={kind}
        categoryId={categoryId}
        categories={categoryList}
        data={data}
        canWrite={canWrite}
        filtered={Boolean(kind || categoryId || period !== "all" || query.source !== undefined)}
      />
    </div>
  );
}
