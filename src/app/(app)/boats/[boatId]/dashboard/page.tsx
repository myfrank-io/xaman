import { notFound } from "next/navigation";
import { subDays, subMonths } from "date-fns";
import { AnchorIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { EngineReadDates } from "@/components/checklist/completable";
import { toChecklistRow, type StatusViewRow } from "@/components/checklist/rows";
import { BoatModel3D } from "@/components/boat-3d/BoatModel3D";
import { EmptyState } from "@/components/common/EmptyState";
import { SectionCard } from "@/components/common/SectionCard";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { ExpensesTeaser } from "@/components/dashboard/ExpensesTeaser";
import { WriteActions } from "@/components/dashboard/WriteActions";
import { BrandNewBlock } from "@/components/dashboard/BrandNewBlock";
import { OutboxCard } from "@/components/offline/OutboxCard";
import { DashboardBanner } from "@/components/dashboard/DashboardBanner";
import { EngineStrip } from "@/components/dashboard/EngineStrip";
import { pickNextDue, type NextDue } from "@/components/dashboard/next-due";
import type { UpcomingEntry } from "@/components/dashboard/queue";
import { UpcomingList } from "@/components/dashboard/UpcomingList";
import { WEEK_DAYS } from "@/lib/attention";
import { toBoatModelData } from "@/lib/boat-3d/data";
import { categoryTotalsFrom, EXPENSE_SOURCES, NO_CATEGORY_COLOR } from "@/lib/expenses";
import { toDateString, todayString } from "@/lib/format";
import { can, type BoatRole } from "@/lib/permissions";
import { loadActivity } from "@/lib/queries/activity";
import { loadItemAttention, loadWeekActivity, pickNames } from "@/lib/queries/attention";
import { activityPath } from "@/lib/queries/boat-routes";
import { completionContext } from "@/lib/queries/completion-context";
import { readBoatRole, readBoatRow } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Ce que la file peut ranger, pas une page.
 *
 * `boat_todo_queue` ne classe qu'un horizon borné — en retard, dû sous trente jours ou vingt-cinq
 * heures, interventions ouvertes des trente prochains jours — donc ce nombre n'est pas une
 * pagination : c'est la garde qui évite de peindre mille lignes sur un carnet laissé en friche.
 * Le carnet de Xaman en compte une dizaine. Si elle était atteinte, les deux liens de pied
 * mènent aux listes complètes, qui savent filtrer.
 */
const QUEUE_LIMIT = 200;
/**
 * Dix lignes de fil : de quoi voir ce qui a bougé depuis la dernière visite sans transformer
 * l'écran en journal. Le reste est à un tap, sur son propre écran (E18-3).
 */
const ACTIVITY_PREVIEW = 10;
/** Combien de points « ok » on regarde pour nommer la prochaine échéance de l'état vide. */
const NEXT_DUE_SAMPLE = 20;
const FALLBACK_COLOR = "#63748A";

type LogStatus = Database["public"]["Enums"]["log_status"];
type Client = Awaited<ReturnType<typeof createClient>>;

const EMPTY_CONTEXT: Awaited<ReturnType<typeof completionContext>> = {
  members: [],
  currentUserId: "",
  currentUserName: "",
};

/**
 * Les lignes complètes des points que la file a déjà classés. Le `select("*")` est voulu : le
 * dialogue « Fait » et le miroir optimiste (`applyCompletion`) lisent presque toute la ligne, et
 * l'onglet « À traiter » lit déjà le même volume de la même vue, en face.
 */
async function loadQueueStatus(
  supabase: Client,
  boatId: string,
  ids: string[],
): Promise<StatusViewRow[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("checklist_item_status")
    .select("*")
    .eq("boat_id", boatId)
    .in("id", ids);
  return data ?? [];
}

/**
 * La prochaine échéance de l'état vide : un échantillon des points « ok », la plus proche des
 * deux échéances retenue par `pickNextDue` (jours ou heures) — voir `next-due.ts`.
 */
async function loadNextDue(supabase: Client, boatId: string): Promise<NextDue | null> {
  const { data } = await supabase
    .from("checklist_item_status")
    .select("label, days_remaining, hours_remaining")
    .eq("boat_id", boatId)
    .eq("status", "ok")
    .order("days_remaining", { ascending: true, nullsFirst: false })
    .limit(NEXT_DUE_SAMPLE);
  return pickNextDue(data ?? []);
}

/**
 * « À bord » (E18-1, D121) : un plan de travail, pas un résumé.
 *
 * Trois zones. **Écrire** : l'acte nommé, au-dessus de la ligne de flottaison (D35). **Faire** :
 * la file entière, rangée par palier, avec « Fait » en ligne. **Savoir** : la phrase d'état et la
 * bande des moteurs — le fil « ce qui a bougé » arrive avec E18-3.
 *
 * Ce que l'écran ne fait plus : redire les pastilles de la navigation en quatre vignettes,
 * redessiner la grille des huit systèmes de la Checklist, recopier le haut du Journal et lister
 * trois liens vers trois onglets.
 */
export default async function DashboardPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const today = todayString();
  const weekSince = toDateString(subDays(new Date(), WEEK_DAYS));

  /**
   * Une seule vague. `boat_dashboard_stats` ne porte plus que les deux comptes du bandeau
   * (0035) : les onze sous-requêtes que les vignettes et le récapitulatif faisaient tourner à
   * chaque rendu n'avaient plus de lecteur. Le compte « À valider » n'est plus lu ici non
   * plus — la file en porte chaque ligne (D122).
   *
   * La ligne du bateau fait exception : `readBoatRow` la lit entière, mais c'est **celle du
   * layout** (`cache()` de React déduplique la requête).
   */
  const [
    { data: boat },
    { data: role },
    { data: stats },
    { data: engines },
    { data: hours },
    { data: queue },
    { data: progress },
    attention,
    week,
    activity,
    { data: modelEngines },
    { data: modelEquipment },
    { data: modelCategories },
    { data: modelPoints },
    { data: expenses },
  ] = await Promise.all([
    readBoatRow(boatId),
    readBoatRole(boatId),
    supabase
      .from("boat_dashboard_stats")
      .select("review_pending_logs, review_pending_purchases")
      .eq("boat_id", boatId)
      .maybeSingle(),
    // D73: an engine without an hour meter has no counter to show and no reading to ask for.
    supabase
      .from("engines")
      .select("id, label")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .eq("tracks_hours", true)
      .order("sort_order"),
    supabase.from("engine_current_hours").select("engine_id, hours, read_at").eq("boat_id", boatId),
    supabase.rpc("boat_todo_queue", { p_boat_id: boatId, p_limit: QUEUE_LIMIT }),
    // Deux colonnes, une seule question : ce carnet a-t-il des points, et sont-ils tous vierges
    // (l'état « carnet neuf ») ? La grille des systèmes qui lisait le reste a quitté l'écran.
    supabase
      .from("checklist_category_progress")
      .select("total, never_recorded_count")
      .eq("boat_id", boatId),
    // Ce qui est *devenu* en retard cette semaine : la moitié droite de la phrase d'état. Les
    // interventions ne sont plus lues ici — leur compte était celui d'une vignette (D88).
    loadItemAttention(supabase, boatId),
    // Ce qui a été réglé sur sept jours : la moitié gauche de la phrase d'état.
    loadWeekActivity(supabase, boatId, weekSince),
    // Ce qui a bougé, avec les noms : la zone « savoir » de l'écran (D123).
    loadActivity(supabase, boatId, ACTIVITY_PREVIEW),
    /**
     * Les quatre lectures de la maquette (E2-8), qui est ici le bloc « consulter mon bateau »
     * (D124). Elles voyagent dans la même vague que le reste : elles n'attendent la réponse de
     * rien, et le `toBoatModelData` qui les assemble est celui de l'onglet Bateau.
     */
    supabase
      .from("engines")
      .select("id, label, position, is_active")
      .eq("boat_id", boatId)
      .order("sort_order")
      .order("label"),
    supabase
      .from("equipment")
      .select("id, name, brand, model, quantity, category_id, external_ref, removed_at, specs")
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name"),
    supabase
      .from("boat_categories")
      .select("id, external_ref")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("checklist_item_status")
      .select(
        "id, label, status, days_remaining, hours_remaining, category_id, engine_id, engine_tracks_hours",
      )
      .eq("boat_id", boatId),
    // Ce que le bateau a coûté sur douze mois, compté par la base (D111) : un total et sa
    // répartition par système, en une lecture.
    supabase
      .rpc("boat_expense_totals", {
        p_boat_id: boatId,
        p_from: toDateString(subMonths(new Date(), 12)),
        p_to: today,
        p_sources: [...EXPENSE_SOURCES],
      })
      .maybeSingle(),
  ]);
  if (!boat || !role) notFound();
  const boatRole = role as BoatRole;
  const canWrite = can(boatRole, "write");
  const canContribute = can(boatRole, "contribute");

  const [t, tb, tsupplies] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("boatType"),
    // « Sans catégorie » a déjà son mot, là où les dépenses se lisent : on le lui emprunte.
    getTranslations("supplies"),
  ]);

  // Engines and their last reading
  const hoursByEngine = new Map((hours ?? []).map((row) => [row.engine_id, row]));
  const engineList = (engines ?? []).map((engine) => ({
    id: engine.id,
    label: engine.label,
    lastHours: hoursByEngine.get(engine.id)?.hours ?? null,
    lastDate: hoursByEngine.get(engine.id)?.read_at ?? null,
  }));
  const noReadingEngines = engineList
    .filter((engine) => engine.lastHours === null)
    .map((engine) => engine.label);
  // The day each counter was last read: the « Fait » dialog fills the hours by itself when the
  // reading is fresh, and asks for them when it is not.
  const engineReadDates: EngineReadDates = Object.fromEntries(
    (hours ?? []).map((row) => [row.engine_id ?? "", row.read_at]),
  );

  // La maquette (E2-8) : les mêmes lignes, le même assemblage que l'onglet Bateau.
  const boatModel = toBoatModelData({
    boat,
    engines: modelEngines ?? [],
    categories: modelCategories ?? [],
    equipment: modelEquipment ?? [],
    points: modelPoints ?? [],
  });
  const expensesTotal = expenses?.total ?? 0;
  const expenseCategories = categoryTotalsFrom(
    expenses?.by_category,
    tsupplies("expenses.uncategorized"),
    NO_CATEGORY_COLOR,
  );

  // The « brand new » state: the carnet has its points and not one has ever been recorded.
  const totalInterval = (progress ?? []).reduce((sum, row) => sum + (row.total ?? 0), 0);
  const neverRecorded = (progress ?? []).reduce(
    (sum, row) => sum + (row.never_recorded_count ?? 0),
    0,
  );
  const brandNew = totalInterval > 0 && neverRecorded === totalInterval;
  /**
   * No plan chosen: the boat has its systems and not one point (D65), so every count below is a
   * truthful zero and the screen would otherwise read « Tout est à jour » on an empty carnet.
   * Step 3 of the onboarding is where that is finished (D67).
   */
  const unfinished = boat.checklist_template_id === null;

  const queueRows = queue ?? [];
  const itemIds = queueRows.filter((row) => row.kind === "item").map((row) => row.id);

  /** Second (and last) wave: everything that needed the queue's answer, in parallel. */
  const [statusRows, context, nextDue] = await Promise.all([
    loadQueueStatus(supabase, boatId, itemIds),
    canContribute && itemIds.length > 0
      ? completionContext(supabase, boatId)
      : Promise.resolve(EMPTY_CONTEXT),
    queueRows.length === 0 && !brandNew
      ? loadNextDue(supabase, boatId)
      : Promise.resolve<NextDue | null>(null),
  ]);

  // The queue, completed with the full status rows so « Fait » works inline
  const statusById = new Map(statusRows.map((row) => [row.id ?? "", row]));
  const entries: UpcomingEntry[] = [];
  for (const row of queueRows) {
    if (row.kind === "item") {
      const status = statusById.get(row.id);
      if (!status) continue;
      entries.push({
        kind: "item",
        row: toChecklistRow(
          status,
          { name: row.category_name, color: row.category_color ?? FALLBACK_COLOR },
          row.engine_label ?? null,
        ),
      });
    } else if (row.kind === "inbox") {
      entries.push({
        kind: "inbox",
        id: row.id,
        title: row.title,
        // `due_at` porte le jour d'arrivée pour un document : il attend depuis, pas jusqu'à.
        receivedAt: row.due_at,
      });
    } else if (row.kind === "part") {
      entries.push({
        kind: "part",
        id: row.id,
        title: row.title,
        missing: Number(row.severity ?? 0),
        categoryName: row.category_name,
        categoryColor: row.category_color,
      });
    } else {
      entries.push({
        kind: "log",
        id: row.id,
        title: row.title,
        status: row.status as LogStatus,
        dueAt: row.due_at,
        categoryName: row.category_name,
        categoryColor: row.category_color ?? FALLBACK_COLOR,
      });
    }
  }

  const reviewCount = (stats?.review_pending_logs ?? 0) + (stats?.review_pending_purchases ?? 0);

  /**
   * La phrase d'état dit ce qui a bougé depuis la dernière fois — ce qui a été réglé, par qui, et
   * si quelque chose est *devenu* en retard. Ce qui reste à faire est la liste, juste dessous.
   */
  const names = pickNames(week.people);
  const nameList = new Intl.ListFormat("fr-FR", { style: "long", type: "conjunction" });
  const namesText =
    names.shown.length === 0
      ? null
      : names.extra > 0
        ? t("state.weekNamesMore", { names: nameList.format(names.shown), count: names.extra })
        : nameList.format(names.shown);
  const settledParts: string[] = [];
  if (week.completions > 0) settledParts.push(t("state.weekItems", { count: week.completions }));
  if (week.logs > 0) settledParts.push(t("state.weekLogs", { count: week.logs }));
  const settledPhrase =
    settledParts.length === 0
      ? t("state.weekNone")
      : namesText
        ? t("state.weekBy", { activity: nameList.format(settledParts), names: namesText })
        : t("state.week", { activity: nameList.format(settledParts) });
  const overduePhrase =
    attention.newlyOverdue > 0
      ? t("state.newOverdue", { count: attention.newlyOverdue })
      : t("state.noNewOverdue");
  const statePhrase = unfinished
    ? t("state.empty")
    : brandNew
      ? t("state.new", { count: totalInterval })
      : `${settledPhrase} · ${overduePhrase}`;

  const subtitle = [
    [boat.model, boat.hull_number ? `#${boat.hull_number}` : null].filter(Boolean).join(" "),
    boat.builder,
    tb(boat.type),
  ]
    .filter(Boolean)
    .join(" · ");

  // Days, hours, or « aucune échéance datée » — the sentence always says something true.
  const nextDueText = !nextDue
    ? t("upcoming.emptyNoDated")
    : nextDue.days !== null
      ? t("upcoming.emptyNext", { label: nextDue.label, days: Math.max(nextDue.days, 0) })
      : nextDue.hours !== null
        ? t("upcoming.emptyNextHours", { label: nextDue.label, hours: Math.round(nextDue.hours) })
        : t("upcoming.emptyNoDated");

  return (
    <div className="flex flex-col gap-6">
      {/* 0 — what is on the iPad and not yet on the server comes before anything else (E9-1b) */}
      <OutboxCard boatId={boatId} />
      {/* 1 — dark header: identity, what has moved, the engine strip */}
      {/* Bleeds to all three edges: the dashboard carries no trail (see `buildTrail`), so there
          is nothing above for this band to paint over — which is what it used to do. */}
      <header className="-mx-4 -mt-3 bg-header-gradient px-4 pt-5 pb-4 text-on-navy brass-rule sm:-mx-6 sm:-mt-4 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-h1">{boat.name}</h1>
            {subtitle ? <p className="mt-0.5 num text-caption text-on-navy-2">{subtitle}</p> : null}
          </div>
          <p className="text-label text-on-navy-2">{statePhrase}</p>
        </div>

        <EngineStrip
          boatId={boatId}
          engines={engineList}
          canContribute={canContribute}
          canWrite={canWrite}
        />
      </header>

      {/* 2 — écrire : deux actes, séparés par le temps du verbe (D124). Ce qu'il faudra faire
          était la porte qui manquait : le bouton nommé ne prenait que ce qui est déjà fait. */}
      {canContribute ? <WriteActions boatId={boatId} /> : null}

      {/* 3 — one contextual banner */}
      <DashboardBanner
        boatId={boatId}
        reviewCount={reviewCount}
        noReadingEngines={noReadingEngines}
        canContribute={canContribute}
        canWrite={canWrite}
        unfinished={unfinished}
      />

      {/* 4 — faire : the whole queue, by tier. The screen is this list. */}
      {brandNew ? (
        <BrandNewBlock
          boatId={boatId}
          count={totalInterval}
          reviewCount={reviewCount}
          steps={{
            hours: engineList.length > 0 && noReadingEngines.length === 0,
            review: reviewCount === 0,
            checklist: false,
          }}
          hasCounters={engineList.length > 0}
          canContribute={canContribute}
        />
      ) : null}
      {entries.length > 0 ? (
        <UpcomingList
          boatId={boatId}
          engineReadDates={engineReadDates}
          entries={entries}
          members={context.members}
          currentUserId={context.currentUserId}
          currentUserName={context.currentUserName}
          canContribute={canContribute}
          today={today}
        />
      ) : brandNew ? null : (
        <EmptyState
          variant="positive"
          icon={<AnchorIcon aria-hidden />}
          title={t("upcoming.emptyTitle")}
          description={nextDueText}
        />
      )}

      {/* 5 — savoir : ce qui a bougé, avec les noms. Le bloc n'existe que s'il a quelque chose à
          dire : sur un carnet neuf, la mise en route parle déjà (D123). */}
      {activity.length > 0 ? (
        <SectionCard
          title={t("activity.title")}
          actionHref={activityPath(boatId)}
          actionLabel={t("activity.all")}
          bare
        >
          <ActivityList rows={activity} />
        </SectionCard>
      ) : null}

      {/* 6 — consulter mon bateau : la maquette d'E2-8, qui est déjà cet objet (D124). Elle
          deviendra « mes bateaux » à l'altitude flotte (E18-6, D121). */}
      <BoatModel3D boatId={boatId} boatName={boat.name} data={boatModel} />

      {/* 7 — découvrir ses dépenses : un montant qu'on regarde, pas un lien qu'on lit (D124). */}
      <ExpensesTeaser boatId={boatId} total={expensesTotal} categories={expenseCategories} />
    </div>
  );
}
