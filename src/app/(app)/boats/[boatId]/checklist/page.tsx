import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ChecklistGrid, toCategoryProgress } from "@/components/checklist/ChecklistGrid";
import { ChecklistViewTabs } from "@/components/checklist/ChecklistViewTabs";
import { TodoList, type TodoFilter } from "@/components/checklist/TodoList";
import { toChecklistRow } from "@/components/checklist/rows";
import { PlusIcon } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { RestockChecklist } from "@/components/parts/RestockChecklist";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { can, type BoatRole } from "@/lib/permissions";
import {
  checklistSetupPath,
  importPath,
  newChecklistItemPath,
  stockPath,
} from "@/lib/queries/boat-routes";
import { completionContext } from "@/lib/queries/completion-context";
import { loadStockItems, toRestockList } from "@/lib/queries/stock";
import { createClient } from "@/lib/supabase/server";

const FILTERS: TodoFilter[] = ["all", "overdue", "soon", "never"];

// Checklist (tab 2): the fixed grid of systems, or the flat « À traiter » list.
export default async function ChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ view?: string; filter?: string }>;
}) {
  const [{ boatId }, { view, filter }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: role }, { data: progress }, { data: status }, { data: engines }, stockItems] =
    await Promise.all([
      supabase.rpc("boat_role", { p_boat_id: boatId }),
      supabase
        .from("checklist_category_progress")
        .select("*")
        .eq("boat_id", boatId)
        .order("sort_order"),
      supabase
        .from("checklist_item_status")
        .select("*")
        .eq("boat_id", boatId)
        .in("status", ["overdue", "soon", "never"]),
      supabase.from("engines").select("id, label").eq("boat_id", boatId),
      // The stock closes the grid: what is aboard, and what is under its threshold (D43). The
      // low lines also feed the « À racheter » checklist above the grid (D61) — one read, one
      // source of truth, so the card and the list can never disagree.
      loadStockItems(supabase, boatId),
    ]);
  if (!role) notFound();
  const boatRole = role as BoatRole;

  const categories = (progress ?? []).map(toCategoryProgress);
  const byCategory = new Map(categories.map((category) => [category.id, category]));
  const engineLabels = new Map((engines ?? []).map((engine) => [engine.id, engine.label]));
  const rows = (status ?? [])
    .filter((row) => row.category_id && byCategory.has(row.category_id))
    .map((row) => {
      const category = byCategory.get(row.category_id ?? "");
      return toChecklistRow(
        row,
        { name: category?.name ?? "", color: category?.color ?? "#63748A" },
        row.engine_id ? (engineLabels.get(row.engine_id) ?? null) : null,
      );
    });
  const todoCount = rows.filter(
    (row) => row.intervalMonths !== null || row.intervalHours !== null || row.status !== "never",
  ).length;

  // Always shown, empty stock included: the card is also the way in. Hiding it on a boat with
  // no part yet left « pièces détachées » nowhere to be found from here — reported at the
  // tiller — and that is exactly the boat that most needs the door (D43).
  const lowParts = toRestockList(stockItems);
  const stock = { total: stockItems.length, low: lowParts.length };

  const totalInterval = categories.reduce((sum, category) => sum + category.total, 0);
  const neverRecorded = categories.reduce((sum, category) => sum + category.neverRecorded, 0);
  const brandNew = totalInterval > 0 && neverRecorded === totalInterval;

  const activeView = view === "todo" ? "todo" : "grid";
  const activeFilter: TodoFilter = FILTERS.includes(filter as TodoFilter)
    ? (filter as TodoFilter)
    : "all";
  const context =
    activeView === "todo"
      ? await completionContext(supabase, boatId)
      : { members: [], currentUserId: "", currentUserName: "" };

  const t = await getTranslations("checklist");
  const ti = await getTranslations("import");
  const tr = await getTranslations("restock");

  return (
    <div className="flex flex-col gap-6">
      {/* Reprendre les points déjà faits d'un tableur commence ici, sur la liste elle-même
          (E12-4) — comme sur Interventions et Dépenses. */}
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          can(boatRole, "write") ? (
            <>
              <Button asChild variant="outline">
                <Link href={importPath(boatId, "completions") as Route}>{ti("action")}</Link>
              </Button>
              {/* A point needs a category, but that is a field of the form, not a condition for
                  opening it (A9): from here the form asks which. */}
              <Button asChild>
                <Link href={newChecklistItemPath(boatId) as Route}>
                  <PlusIcon />
                  {t("addItem")}
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />
      {brandNew && can(boatRole, "write") ? (
        <Alert variant="info">
          <AlertTitle>{t("setup.banner")}</AlertTitle>
          <AlertDescription>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={checklistSetupPath(boatId) as Route}>{t("setup.cta")}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <ChecklistViewTabs boatId={boatId} view={activeView} todoCount={todoCount} />
      {activeView === "grid" ? (
        <>
          {/* « À racheter » before the systems (D61): the spare parts to buy back sit where the
              eye already is when planning the work — a checklist derived from the stock, ticked
              off as the parts come aboard, never a second list to keep. */}
          {lowParts.length > 0 ? (
            <SectionCard
              title={tr("title")}
              actionHref={stockPath(boatId)}
              actionLabel={tr("seeStock")}
              footer={tr("subtitle")}
              bare
            >
              <RestockChecklist
                boatId={boatId}
                parts={lowParts}
                canWrite={can(boatRole, "write")}
              />
            </SectionCard>
          ) : null}
          <ChecklistGrid boatId={boatId} categories={categories} stock={stock} />
        </>
      ) : (
        <TodoList
          boatId={boatId}
          rows={rows.filter((row) => row.intervalMonths !== null || row.intervalHours !== null)}
          filter={activeFilter}
          members={context.members}
          currentUserId={context.currentUserId}
          currentUserName={context.currentUserName}
          canContribute={can(boatRole, "contribute")}
        />
      )}
    </div>
  );
}
