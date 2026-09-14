import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { subDays } from "date-fns";
import { AnchorIcon, PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { EngineReadDates } from "@/components/checklist/completable";
import { toChecklistRow, type StatusViewRow } from "@/components/checklist/rows";
import { EmptyState } from "@/components/common/EmptyState";
import { BrandNewBlock } from "@/components/dashboard/BrandNewBlock";
import { OutboxCard } from "@/components/offline/OutboxCard";
import { DashboardBanner } from "@/components/dashboard/DashboardBanner";
import { EngineStrip } from "@/components/dashboard/EngineStrip";
import { pickNextDue, type NextDue } from "@/components/dashboard/next-due";
import type { UpcomingEntry } from "@/components/dashboard/queue";
import { UpcomingList } from "@/components/dashboard/UpcomingList";
import { WEEK_DAYS } from "@/lib/attention";
import { toDateString, todayString } from "@/lib/format";
import { can, type BoatRole } from "@/lib/permissions";
import { loadItemAttention, loadWeekActivity, pickNames } from "@/lib/queries/attention";
import { newLogPath } from "@/lib/queries/boat-routes";
import { pendingInboxCount } from "@/lib/queries/inbox";
import { Button } from "@/components/ui/button";
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
   * Une seule vague. `boat_dashboard_stats` n'est plus lu que pour les deux comptes du bandeau :
   * les colonnes que les vignettes et le récapitulatif faisaient calculer (dépenses sur douze
   * mois, sortie de l'eau, stock, états des points) n'ont plus de lecteur ici, et la vue perd
   * les siennes avec E18-2.
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
    inboxCount,
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
    // Documents waiting on « À valider » (D91): a narrow count, read here rather than in the view.
    pendingInboxCount(supabase, boatId),
  ]);
  if (!boat || !role) notFound();
  const boatRole = role as BoatRole;
  const canWrite = can(boatRole, "write");
  const canContribute = can(boatRole, "contribute");

  const [t, tb, tcreate] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("boatType"),
    getTranslations("create"),
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

      {/* 2 — écrire : the dominant act, named, on the screen a cold start lands on (D35). From
          `lg` the sidebar already carries « Noter une intervention »: one named primary action
          per viewport, never two. */}
      {canContribute ? (
        <div className="lg:hidden">
          <Button asChild size="xl" className="w-full sm:w-auto">
            <Link href={newLogPath(boatId) as Route}>
              <PlusIcon />
              {tcreate("primary")}
            </Link>
          </Button>
        </div>
      ) : null}

      {/* 3 — one contextual banner */}
      <DashboardBanner
        boatId={boatId}
        inboxCount={inboxCount}
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
    </div>
  );
}
