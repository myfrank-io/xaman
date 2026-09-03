import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ChecklistGrid, toCategoryProgress } from "@/components/checklist/ChecklistGrid";
import { ChecklistViewTabs } from "@/components/checklist/ChecklistViewTabs";
import { TodoList, type TodoFilter } from "@/components/checklist/TodoList";
import { toChecklistRow } from "@/components/checklist/rows";
import { PageHeader } from "@/components/common/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { can, type BoatRole } from "@/lib/permissions";
import { checklistSetupPath, importPath } from "@/lib/queries/boat-routes";
import { completionContext } from "@/lib/queries/completion-context";
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
  const [{ data: role }, { data: progress }, { data: status }, { data: engines }] =
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

  return (
    <div className="flex flex-col gap-6">
      {/* Reprendre les points déjà faits d'un tableur commence ici, sur la liste elle-même
          (E12-4) — comme sur Interventions et Dépenses. */}
      <PageHeader
        title={t("title")}
        actions={
          can(boatRole, "write") ? (
            <Button asChild variant="outline">
              <Link href={importPath(boatId, "completions") as Route}>{ti("action")}</Link>
            </Button>
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
        <ChecklistGrid boatId={boatId} categories={categories} />
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
