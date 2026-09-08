import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ChecklistGrid, toCategoryProgress } from "@/components/checklist/ChecklistGrid";
import { ChecklistViewTabs } from "@/components/checklist/ChecklistViewTabs";
import { ChoosePlanBlock } from "@/components/checklist/ChoosePlanBlock";
import type { EngineReadDates } from "@/components/checklist/completable";
import { TodoList, type TodoFilter } from "@/components/checklist/TodoList";
import { countAttention, isDueToday, toChecklistRow } from "@/components/checklist/rows";
import { PlusIcon } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { QuickRestockAdd } from "@/components/parts/QuickRestockAdd";
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
import { boatPlanChoice } from "@/lib/queries/boat-plan";
import { completionContext } from "@/lib/queries/completion-context";
import { loadStockItems, toRestockList } from "@/lib/queries/stock";
import { readBoatRole, readBoatRow } from "@/lib/queries/boat-context";
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
  // Les deux vues et leur filtre se lisent dans l'URL : ce qui n'en dépend que peut partir tout
  // de suite, y compris le contexte de cochage — il attendait la grille sans rien lui devoir.
  const activeView = view === "todo" ? "todo" : "grid";
  const activeFilter: TodoFilter = FILTERS.includes(filter as TodoFilter)
    ? (filter as TodoFilter)
    : "all";
  const [
    { data: role },
    { data: boat },
    { data: progress },
    { data: status },
    { data: engines },
    { data: readings },
    stockItems,
    context,
  ] = await Promise.all([
    readBoatRole(boatId),
    // Déjà lu par le layout : gratuit ici, et c'est lui qui dit si le plan reste à choisir.
    readBoatRow(boatId),
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
    supabase.from("engine_current_hours").select("engine_id, read_at").eq("boat_id", boatId),
    // The stock closes the grid: what is aboard, and what is under its threshold (D84). The
    // low lines also feed the « À racheter » checklist above the grid (D63) — one read, one
    // source of truth, so the card and the list can never disagree.
    loadStockItems(supabase, boatId),
    activeView === "todo"
      ? completionContext(supabase, boatId)
      : Promise.resolve({ members: [], currentUserId: "", currentUserName: "" }),
  ]);
  if (!role) notFound();
  const boatRole = role as BoatRole;

  // D65: creation gives a boat its systems but no maintenance plan, and `checklist_template_id`
  // stays null until one is chosen. That null is what puts the choice on this screen.
  //
  // Le null se lit sur la ligne que le layout a déjà chargée : sur un bateau dont le plan est
  // choisi — c'est-à-dire tous, passé le premier jour — l'écran ne pose plus la question à la
  // base pour s'entendre répondre « non ».
  const plan =
    can(boatRole, "write") && boat?.checklist_template_id === null
      ? await boatPlanChoice(supabase, boatId)
      : null;

  const categories = (progress ?? []).map(toCategoryProgress);
  const byCategory = new Map(categories.map((category) => [category.id, category]));
  const engineLabels = new Map((engines ?? []).map((engine) => [engine.id, engine.label]));
  // The day each counter was last read: a fresh reading fills the hours of a tick by itself.
  const engineReadDates: EngineReadDates = Object.fromEntries(
    (readings ?? []).map((row) => [row.engine_id ?? "", row.read_at]),
  );
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
  // Un contrôle ponctuel entre dans « À traiter » quand il porte une vraie échéance — une date
  // de validité dépassée ou proche (D11) ; « jamais fait » reste de l'information. La liste et
  // son compteur lisent le même filtre : un point rouge doit mener à une ligne, pas à un vide.
  const todoRows = rows.filter(
    (row) => row.intervalMonths !== null || row.intervalHours !== null || row.status !== "never",
  );
  const todoCount = todoRows.length;
  // Le point rouge, du haut de l'écran jusqu'à la tuile du système : en retard, ou dû dans la
  // journée (D88). Le compte gris de l'onglet « À traiter » continue de dire les trente jours.
  const attentionCount = countAttention(rows);
  const dueTodayByCategory = new Map<string, number>();
  for (const row of rows) {
    if (!isDueToday(row)) continue;
    dueTodayByCategory.set(row.categoryId, (dueTodayByCategory.get(row.categoryId) ?? 0) + 1);
  }
  const gridCategories = categories.map((category) => ({
    ...category,
    dueToday: dueTodayByCategory.get(category.id) ?? 0,
  }));

  // Always shown, empty stock included: the card is also the way in. Hiding it on a boat with
  // no part yet left « pièces détachées » nowhere to be found from here — reported at the
  // tiller — and that is exactly the boat that most needs the door (D84).
  const lowParts = toRestockList(stockItems);
  const stock = { total: stockItems.length, low: lowParts.length };

  const totalInterval = categories.reduce((sum, category) => sum + category.total, 0);
  const neverRecorded = categories.reduce((sum, category) => sum + category.neverRecorded, 0);
  const brandNew = totalInterval > 0 && neverRecorded === totalInterval;

  const [t, ti, tr] = await Promise.all([
    getTranslations("checklist"),
    getTranslations("import"),
    getTranslations("restock"),
  ]);

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
      {plan ? (
        <ChoosePlanBlock
          boatId={boatId}
          templates={plan.templates}
          suggestedTemplateId={plan.suggestedTemplateId}
        />
      ) : null}
      {!plan && brandNew && can(boatRole, "write") ? (
        <Alert variant="info">
          <AlertTitle>{t("setup.banner")}</AlertTitle>
          <AlertDescription>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={checklistSetupPath(boatId) as Route}>{t("setup.cta")}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <ChecklistViewTabs
        boatId={boatId}
        view={activeView}
        todoCount={todoCount}
        attentionCount={attentionCount}
      />
      {activeView === "grid" ? (
        <>
          {/* « À racheter » before the systems (D63): the spare parts to buy back sit where
              the eye already is when planning the work — a checklist derived from the stock,
              its + / − adding stock on the spot, never a second list to keep. « Noter une pièce
              à racheter » adds straight from here: the note is the stock line (0 en réserve), so
              it lands both here and in the stock without a second entry. Shown for a writer even
              when nothing is low, so the door to note something is always here rather than a
              redirect to Bateau. */}
          {can(boatRole, "write") || lowParts.length > 0 ? (
            <SectionCard
              title={tr("title")}
              action={can(boatRole, "write") ? <QuickRestockAdd boatId={boatId} /> : undefined}
              actionHref={can(boatRole, "write") ? undefined : stockPath(boatId)}
              actionLabel={can(boatRole, "write") ? undefined : tr("seeStock")}
              footer={lowParts.length > 0 ? tr("subtitle") : undefined}
              bare
            >
              {lowParts.length > 0 ? (
                <RestockChecklist
                  boatId={boatId}
                  parts={lowParts}
                  canWrite={can(boatRole, "write")}
                />
              ) : (
                <p className="rounded-xl border border-border bg-surface p-4 text-body text-ink-2 shadow-sm">
                  {tr("emptyHint")}
                </p>
              )}
            </SectionCard>
          ) : null}
          <ChecklistGrid boatId={boatId} categories={gridCategories} stock={stock} />
        </>
      ) : (
        <TodoList
          engineReadDates={engineReadDates}
          boatId={boatId}
          rows={todoRows}
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
