import Link from "next/link";
import { Suspense } from "react";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";

import { toCategoryProgress } from "@/components/checklist/ChecklistGrid";
import { ChoosePlanBlock } from "@/components/checklist/ChoosePlanBlock";
import { toChecklistRow } from "@/components/checklist/rows";
import { ChecklistBoard } from "@/components/checklist/ChecklistBoard";
import { completionContext } from "@/lib/queries/completion-context";
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
import { loadStockItems, toRestockList } from "@/lib/queries/stock";
import { readBoatRole, readBoatRow } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

/** The maintenance checks themselves, grouped by system (D148). */
export default async function ChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ boatId }, { view }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [
    { data: role },
    { data: boat },
    { data: progress },
    { data: status, error: statusError },
    stockItems,
    { data: engines },
    { data: readings },
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
    supabase.from("checklist_item_status").select("*").eq("boat_id", boatId).order("sort_order"),
    // Le stock ferme la grille : ce qui est à bord, et ce qui est sous son seuil (D84).
    loadStockItems(supabase, boatId),
    supabase.from("engines").select("id, label").eq("boat_id", boatId),
    supabase.from("engine_current_hours").select("engine_id, read_at").eq("boat_id", boatId),
    completionContext(supabase, boatId),
  ]);
  if (!role) notFound();
  if (statusError) throw statusError;
  const boatRole = role as BoatRole;

  // D65 : la création donne ses systèmes à un bateau mais pas son plan d'entretien, et
  // `checklist_template_id` reste null jusqu'au choix. Ce null est ce qui pose la question ici.
  const plan =
    can(boatRole, "write") && boat?.checklist_template_id === null
      ? await boatPlanChoice(supabase, boatId)
      : null;

  const categories = (progress ?? []).map(toCategoryProgress);
  const byCategory = new Map(categories.map((category) => [category.id, category]));
  const engineLabels = new Map((engines ?? []).map((engine) => [engine.id, engine.label]));
  const rows = (status ?? []).flatMap((row) => {
    const category = row.category_id ? byCategory.get(row.category_id) : undefined;
    return category
      ? [
          toChecklistRow(
            row,
            category,
            row.engine_id ? (engineLabels.get(row.engine_id) ?? null) : null,
          ),
        ]
      : [];
  });
  const engineReadDates = Object.fromEntries(
    (readings ?? []).map((reading) => [reading.engine_id ?? "", reading.read_at]),
  );
  const lowParts = toRestockList(stockItems);

  // Un carnet dont rien n'a jamais été noté : les 93 points de l'ORC 50 arrivent tous « jamais
  // noté », et un écran qui s'ouvre sur 93 lignes rouges n'oriente personne. La mise en route,
  // qui demande par système à quand remonte la dernière fois, est ce qui les change en échéances.
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
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          can(boatRole, "write") ? (
            <>
              <Button asChild variant="outline">
                <Link href={importPath(boatId, "completions") as Route}>{ti("action")}</Link>
              </Button>
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
      <Suspense>
        <ChecklistBoard
          boatId={boatId}
          categories={categories}
          rows={rows}
          members={context.members}
          currentUserId={context.currentUserId}
          currentUserName={context.currentUserName}
          canContribute={can(boatRole, "contribute")}
          canWrite={can(boatRole, "write")}
          engineReadDates={engineReadDates}
          initialFilter={view === "all" ? "all" : view === "unrecorded" ? "unrecorded" : "todo"}
        />
      </Suspense>
      {lowParts.length > 0 ? (
        <SectionCard
          title={tr("title")}
          action={can(boatRole, "write") ? <QuickRestockAdd boatId={boatId} /> : undefined}
          actionHref={can(boatRole, "write") ? undefined : stockPath(boatId)}
          actionLabel={can(boatRole, "write") ? undefined : tr("seeStock")}
          footer={tr("subtitle")}
          bare
        >
          <RestockChecklist boatId={boatId} parts={lowParts} canWrite={can(boatRole, "write")} />
        </SectionCard>
      ) : null}
    </div>
  );
}
