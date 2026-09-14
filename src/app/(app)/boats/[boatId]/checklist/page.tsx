import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";

import { ChecklistGrid, toCategoryProgress } from "@/components/checklist/ChecklistGrid";
import { ChoosePlanBlock } from "@/components/checklist/ChoosePlanBlock";
import { isDueToday, toChecklistRow } from "@/components/checklist/rows";
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

/**
 * Checklist (onglet 2) — **le plan du bateau** : ce qui est suivi, par système (E20-1).
 *
 * L'écran avait trois portes pour la même chose : la grille des systèmes, une liste plate
 * « À traiter » à quatre onglets, et — un onglet plus loin — la file du tableau de bord. Aucune
 * ne faisait autorité, et les trois montraient les mêmes lignes autrement.
 *
 * Il n'en reste qu'une, et le partage est net depuis que le tableau de bord est devenu le plan
 * de travail (D121) : **« À bord » répond à « qu'est-ce que je fais aujourd'hui »**, toute la
 * file rangée par palier ; **« Checklist » répond à « qu'est-ce qu'on suit sur ce bateau »**.
 * Une question par écran, et la liste plate — qui redisait la première depuis le second — a
 * disparu avec ses onglets.
 *
 * Ce qui change ici tient donc moins à cet écran qu'à ceux qu'il ouvre : la ligne d'un système
 * (`TodoRow`) donne enfin toute la largeur à son titre, l'échéance se lit en toutes lettres, et
 * cocher coûte un geste (`use-tick`).
 */
export default async function ChecklistPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: boat }, { data: progress }, { data: status }, stockItems] =
    await Promise.all([
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
      // Le stock ferme la grille : ce qui est à bord, et ce qui est sous son seuil (D84).
      loadStockItems(supabase, boatId),
    ]);
  if (!role) notFound();
  const boatRole = role as BoatRole;

  // D65 : la création donne ses systèmes à un bateau mais pas son plan d'entretien, et
  // `checklist_template_id` reste null jusqu'au choix. Ce null est ce qui pose la question ici.
  const plan =
    can(boatRole, "write") && boat?.checklist_template_id === null
      ? await boatPlanChoice(supabase, boatId)
      : null;

  const categories = (progress ?? []).map(toCategoryProgress);
  const byCategory = new Map(categories.map((category) => [category.id, category]));
  // Le point rouge d'une tuile ne dit qu'une chose : en retard, ou dû dans la journée (D88).
  const dueTodayByCategory = new Map<string, number>();
  for (const row of status ?? []) {
    const category = row.category_id ? byCategory.get(row.category_id) : undefined;
    if (!category) continue;
    const checklistRow = toChecklistRow(row, { name: category.name, color: category.color }, null);
    if (!isDueToday(checklistRow)) continue;
    dueTodayByCategory.set(category.id, (dueTodayByCategory.get(category.id) ?? 0) + 1);
  }
  const gridCategories = categories.map((category) => ({
    ...category,
    dueToday: dueTodayByCategory.get(category.id) ?? 0,
  }));

  const lowParts = toRestockList(stockItems);
  const stock = { total: stockItems.length, low: lowParts.length };

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
      {/* « À racheter » avant les systèmes (D63) : les pièces à racheter sont là où l'œil se
          trouve déjà quand on prépare le travail, et le + / − ajoute du stock sur place. */}
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
            <RestockChecklist boatId={boatId} parts={lowParts} canWrite={can(boatRole, "write")} />
          ) : (
            <p className="rounded-xl border border-border bg-surface p-4 text-body text-ink-2 shadow-sm">
              {tr("emptyHint")}
            </p>
          )}
        </SectionCard>
      ) : null}
      <ChecklistGrid boatId={boatId} categories={gridCategories} stock={stock} />
    </div>
  );
}
