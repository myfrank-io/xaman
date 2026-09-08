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
import { parseEngineHours } from "@/components/logs/rows";
import {
  buildExpenseDetails,
  expenseKey,
  isExpensePeriod,
  NO_CATEGORY,
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
import { readBoatRole } from "@/lib/queries/boat-context";
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
  // « Sans catégorie » is a bucket, not an id: it is the one filter that reads a null.
  if (categoryId === NO_CATEGORY) listQuery = listQuery.is("category_id", null);
  else if (categoryId) listQuery = listQuery.eq("category_id", categoryId);

  /**
   * « Toute la période », sans système ni type : la liste ci-dessus **est** déjà l'historique
   * complet de ces sources (la borne basse de la période est l'époque, 1900). La seconde
   * lecture reposait alors la même question à la base pour en refaire la somme — sur l'écran
   * d'arrivée, celui qu'on ouvre neuf fois sur dix, et sur un carnet papier repris ça fait
   * deux fois toutes les lignes de dépense du bateau.
   *
   * Dès qu'un filtre restreint la liste, l'historique reste nécessaire : le cumul et la date de
   * première dépense ne suivent aucun filtre, et la période précédente est hors de la fenêtre.
   */
  const derivedHistory = period === "all" && !categoryId && !kind;

  // Une seule vague : les filtres viennent de l'URL, rien ici n'attend la réponse d'autre chose.
  // Le rôle et les systèmes formaient une première vague à eux seuls, devant tout le reste.
  const [
    { data: role },
    { data: categories },
    { data: rows },
    { data: history },
    { data: contacts },
    { data: gasRows },
  ] = await Promise.all([
    readBoatRole(boatId),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon, external_ref")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    listQuery.order("date", { ascending: false }),
    // Light query (two columns) feeding both the comparison and the running total.
    derivedHistory
      ? Promise.resolve({ data: null })
      : supabase
          .from("expenses_by_category")
          .select("amount, date")
          .eq("boat_id", boatId)
          .in("source", sources)
          .order("date", { ascending: true }),
    supabase
      .from("contacts")
      .select("id, name, specialty, company, phone")
      .eq("boat_id", boatId)
      .is("deleted_at", null)
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
  if (!role) notFound();
  const canWrite = can(role as BoatRole, "write");
  const categoryList = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));

  // `rows` descend par date ; l'historique montait. Le cumul ne lit que des montants et la
  // première dépense n'est que le dernier élément d'une liste triée : l'ordre suffit à les dire.
  const all: { amount: number | null; date: string | null }[] =
    history ?? (rows ?? []).map((row) => ({ amount: row.amount, date: row.date }));
  const cumulativeTotal = all.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const firstDate = (history ? all[0] : all[all.length - 1])?.date ?? null;
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

  // The view carries neither the supplier nor the imported-line flag, and it says nothing of
  // what a line actually paid for. One read per source, keyed by the ids of the **page** only,
  // fills both the merged list and the recap each line unrolls (D86).
  const page = expenseRows.slice(0, limit);
  const idsOf = (source: string) =>
    page
      .filter((row) => row.source === source)
      .map((row) => row.entityId)
      .filter((id): id is string => Boolean(id));
  const purchaseIds = idsOf("purchase");
  const logIds = idsOf("log");
  const haulOutIds = idsOf("haul_out");

  const [{ data: purchaseExtras }, { data: logExtras }, { data: haulOutExtras }, { data: ashore }] =
    await Promise.all([
      purchaseIds.length
        ? supabase
            .from("purchases")
            .select(
              "id, designation, bottle_type, notes, needs_review, supplier_contact_id, supplier_name, maintenance_log_id, maintenance_logs(id, title)",
            )
            .in("id", purchaseIds)
        : Promise.resolve({ data: null }),
      logIds.length
        ? supabase
            .from("maintenance_logs_view")
            .select(
              "id, status, contact_name, equipment_name, notes, completions_count, purchases_count, attachments_count, needs_review, haul_out_id, engine_hours",
            )
            .in("id", logIds)
        : Promise.resolve({ data: null }),
      haulOutIds.length
        ? supabase
            .from("haul_outs")
            .select("id, yard_name, yard_contact_id, started_at, ended_at, works")
            .in("id", haulOutIds)
        : Promise.resolve({ data: null }),
      // A haul-out is a period, not a bill: what it really cost is the yard plus the
      // interventions of those days (E6-1), and the recap says so without opening it.
      haulOutIds.length
        ? supabase
            .from("maintenance_logs")
            .select("haul_out_id, cost")
            .in("haul_out_id", haulOutIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: null }),
    ]);
  const contactNames = new Map((contacts ?? []).map((contact) => [contact.id, contact.name]));
  const extras = new Map((purchaseExtras ?? []).map((row) => [row.id, row]));

  const details = buildExpenseDetails({
    logs: (logExtras ?? []).map((row) => ({
      ...row,
      engineHours: parseEngineHours(row.engine_hours).map(({ label, hours }) => ({
        label,
        hours,
      })),
    })),
    purchases: purchaseExtras ?? [],
    haulOuts: haulOutExtras ?? [],
    haulOutLogs: ashore ?? [],
    contactNames,
    logTitles: new Map(
      (purchaseExtras ?? []).flatMap((row) => {
        const linked = row.maintenance_logs;
        return linked ? [[linked.id, linked.title] as const] : [];
      }),
    ),
  });

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
      detail: details.get(expenseKey(row.source, row.entityId)) ?? null,
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
    cumulativeTotal,
    firstDate,
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
