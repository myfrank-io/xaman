import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { ExpensesTab, type ExpensesData } from "@/components/supplies/ExpensesTab";
import { GasBottleEntry } from "@/components/supplies/GasBottleEntry";
import { GasFacts } from "@/components/supplies/GasFacts";
import { PurchaseFilters } from "@/components/supplies/PurchaseFilters";
import { PurchaseList, type PurchaseListItem } from "@/components/supplies/PurchaseList";
import { StockList, type StockItem } from "@/components/supplies/StockList";
import { SuppliesTabs, type SuppliesView } from "@/components/supplies/SuppliesTabs";
import {
  isExpensePeriod,
  parseSources,
  previousRange,
  resolveRange,
  type ExpenseRow,
} from "@/lib/expenses";
import { gasFacts } from "@/lib/gas";
import { applyStockFilter, countLowStock, sortStock, type StockFilter } from "@/lib/parts";
import { can, type BoatRole } from "@/lib/permissions";
import {
  isPurchaseKind,
  isPurchasePeriod,
  parsePurchaseLimit,
  PURCHASE_PAGE_SIZE,
  resolvePurchaseRange,
} from "@/lib/purchases";
import { suppliesPath } from "@/lib/queries/boat-routes";
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
 * Dépenses (E5-1): three tabs in the URL — Dépenses (default), Achats, Stock. Gas is not a
 * fourth tab but a filter of Achats plus a quick dialog (`?tab=gas`), which is where the
 * app's « + » sheet lands.
 */
export default async function SuppliesPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ boatId }, query] = await Promise.all([params, searchParams]);
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

  // `?tab=gas` is the « + » sheet entry: the purchases tab, filtered, dialog open.
  const gasEntry = query.tab === "gas";
  const tab: SuppliesView =
    gasEntry || query.tab === "purchases"
      ? "purchases"
      : query.tab === "stock"
        ? "stock"
        : "expenses";

  const t = await getTranslations("supplies");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SuppliesTabs boatId={boatId} active={tab} />
      {tab === "expenses" ? (
        <ExpensesSection boatId={boatId} query={query} />
      ) : tab === "purchases" ? (
        <PurchasesSection
          boatId={boatId}
          query={query}
          gasEntry={gasEntry}
          canWrite={canWrite}
          categories={categoryList}
          categoryRefs={categories ?? []}
        />
      ) : (
        <StockSection boatId={boatId} query={query} canWrite={canWrite} categories={categoryList} />
      )}
    </div>
  );
}

async function ExpensesSection({ boatId, query }: { boatId: string; query: SearchParams }) {
  const supabase = await createClient();
  const period = isExpensePeriod(query.period) ? query.period : "rolling12";
  const range = resolveRange(period, { from: query.from, to: query.to });
  const sources = parseSources(query.source);
  const previous = previousRange(period, range);

  const [{ data: rows }, { data: history }] = await Promise.all([
    supabase
      .from("expenses_by_category")
      .select("source, entity_id, label, amount, date, category_id, category_name, category_color")
      .eq("boat_id", boatId)
      .gte("date", range.from)
      .lte("date", range.to)
      .in("source", sources)
      .order("date", { ascending: false }),
    // Light query (two columns) feeding both the comparison and the running total.
    supabase
      .from("expenses_by_category")
      .select("amount, date")
      .eq("boat_id", boatId)
      .in("source", sources)
      .order("date", { ascending: true }),
  ]);

  const all = history ?? [];
  const previousTotal = all
    .filter((row) => (row.date ?? "") >= previous.from && (row.date ?? "") <= previous.to)
    .reduce((sum, row) => sum + (row.amount ?? 0), 0);

  const data: ExpensesData = {
    rows: (rows ?? []).map((row): ExpenseRow => ({
      source: row.source,
      entityId: row.entity_id,
      label: row.label,
      amount: row.amount,
      date: row.date,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryColor: row.category_color,
    })),
    previousTotal,
    cumulativeTotal: all.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    firstDate: all[0]?.date ?? null,
  };

  return (
    <ExpensesTab
      boatId={boatId}
      period={period}
      range={range}
      sources={sources}
      data={data}
      filtered={period !== "rolling12" || query.source !== undefined}
    />
  );
}

async function PurchasesSection({
  boatId,
  query,
  gasEntry,
  canWrite,
  categories,
  categoryRefs,
}: {
  boatId: string;
  query: SearchParams;
  gasEntry: boolean;
  canWrite: boolean;
  categories: { id: string; name: string; color: string; icon: string | null }[];
  categoryRefs: { id: string; external_ref: string | null }[];
}) {
  const supabase = await createClient();
  const kind = gasEntry ? "gas" : isPurchaseKind(query.kind) ? query.kind : null;
  const categoryId = query.category ?? null;
  const period = isPurchasePeriod(query.period) ? query.period : "all";
  const range = resolvePurchaseRange(period, { from: query.from, to: query.to });
  const limit = parsePurchaseLimit(query.limit);
  const gasView = kind === "gas";

  let list = supabase
    .from("purchases")
    .select(
      "id, purchased_at, designation, kind, amount, category_id, supplier_contact_id, supplier_name, needs_review",
    )
    .eq("boat_id", boatId)
    .is("deleted_at", null);
  if (kind) list = list.eq("kind", kind);
  if (categoryId) list = list.eq("category_id", categoryId);
  if (range) list = list.gte("purchased_at", range.from).lte("purchased_at", range.to);

  const [{ data: rows }, { data: contacts }, { data: gasRows }] = await Promise.all([
    // One row more than the page: that is how « Charger plus » knows it has something to show.
    list
      .order("purchased_at", { ascending: false })
      .order("id")
      .limit(limit + 1),
    supabase
      .from("contacts")
      .select("id, name, specialty, company, phone")
      .eq("boat_id", boatId)
      .order("name"),
    gasView
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

  const contactNames = new Map((contacts ?? []).map((contact) => [contact.id, contact.name]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const page = (rows ?? []).slice(0, limit);
  const purchases: PurchaseListItem[] = page.map((row) => {
    const category = row.category_id ? categoryById.get(row.category_id) : undefined;
    return {
      id: row.id,
      purchasedAt: row.purchased_at,
      designation: row.designation,
      kind: row.kind,
      amount: row.amount,
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      supplier: row.supplier_contact_id
        ? (contactNames.get(row.supplier_contact_id) ?? null)
        : row.supplier_name,
      needsReview: row.needs_review,
    };
  });

  const moreHref =
    (rows ?? []).length > limit
      ? suppliesPath(boatId, "purchases", {
          kind: kind ?? undefined,
          category: categoryId ?? undefined,
          period: period === "all" ? undefined : period,
          from: period === "custom" ? range?.from : undefined,
          to: period === "custom" ? range?.to : undefined,
          limit: limit + PURCHASE_PAGE_SIZE,
        })
      : null;

  const gas = gasRows ?? [];
  const facts = gasFacts(gas.map((row) => row.purchased_at));
  const last = gas[0];
  const defaults = {
    bottleTypes: [
      ...new Set(gas.map((row) => row.bottle_type).filter((type): type is string => Boolean(type))),
    ],
    bottleType: last?.bottle_type ?? null,
    supplierContactId: last?.supplier_contact_id ?? null,
    supplierName: last?.supplier_name ?? null,
    categoryId:
      last?.category_id ??
      categoryRefs.find((category) => category.external_ref === GAS_CATEGORY_REF)?.id ??
      null,
  };

  return (
    <div className="flex flex-col gap-6">
      {gasView ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <GasFacts facts={facts} total={gas.reduce((sum, row) => sum + (row.amount ?? 0), 0)} />
          </div>
          {canWrite ? (
            <GasBottleEntry
              boatId={boatId}
              contacts={contacts ?? []}
              defaults={defaults}
              facts={facts}
              defaultOpen={gasEntry}
            />
          ) : null}
        </div>
      ) : null}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <PurchaseFilters
          boatId={boatId}
          categories={categories}
          kind={kind}
          categoryId={categoryId}
          period={period}
          range={range ?? resolveRange("rolling12", {})}
        />
      </div>
      <PurchaseList
        boatId={boatId}
        purchases={purchases}
        canWrite={canWrite}
        filtered={Boolean(kind || categoryId || period !== "all")}
        moreHref={moreHref}
      />
    </div>
  );
}

async function StockSection({
  boatId,
  query,
  canWrite,
  categories,
}: {
  boatId: string;
  query: SearchParams;
  canWrite: boolean;
  categories: { id: string; name: string; color: string; icon: string | null }[];
}) {
  const supabase = await createClient();
  const filter: StockFilter = query.low === "1" ? "low" : "all";

  const [{ data: rows }, { data: contacts }] = await Promise.all([
    supabase
      .from("parts")
      .select(
        "id, name, reference, quantity, min_quantity, unit, location, category_id, supplier_contact_id, checked_at",
      )
      .eq("boat_id", boatId)
      .order("name"),
    supabase.from("contacts").select("id, name").eq("boat_id", boatId),
  ]);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const contactNames = new Map((contacts ?? []).map((contact) => [contact.id, contact.name]));
  const all: StockItem[] = sortStock(
    (rows ?? []).map((row) => {
      const category = row.category_id ? categoryById.get(row.category_id) : undefined;
      return {
        id: row.id,
        name: row.name,
        reference: row.reference,
        quantity: row.quantity,
        minQuantity: row.min_quantity,
        unit: row.unit,
        location: row.location,
        categoryName: category?.name ?? null,
        categoryColor: category?.color ?? null,
        supplierName: row.supplier_contact_id
          ? (contactNames.get(row.supplier_contact_id) ?? null)
          : null,
        checkedAt: row.checked_at,
      };
    }),
  );

  return (
    <StockList
      boatId={boatId}
      parts={applyStockFilter(all, filter)}
      canWrite={canWrite}
      filter={filter}
      lowCount={countLowStock(all)}
      totalCount={all.length}
    />
  );
}
