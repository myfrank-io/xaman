import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { subDays } from "date-fns";
import { AnchorIcon, PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ChecklistGrid, toCategoryProgress } from "@/components/checklist/ChecklistGrid";
import type { EngineReadDates } from "@/components/checklist/completable";
import { toChecklistRow, type StatusViewRow } from "@/components/checklist/rows";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { BrandNewBlock } from "@/components/dashboard/BrandNewBlock";
import { OutboxCard } from "@/components/offline/OutboxCard";
import { DashboardBanner } from "@/components/dashboard/DashboardBanner";
import { EngineStrip } from "@/components/dashboard/EngineStrip";
import { pickNextDue, type NextDue } from "@/components/dashboard/next-due";
import { UpcomingList, type UpcomingEntry } from "@/components/dashboard/UpcomingList";
import { Badge } from "@/components/ui/badge";
import { WEEK_DAYS } from "@/lib/attention";
import { formatCurrency, formatDate, toDateString, todayString } from "@/lib/format";
import { can, type BoatRole } from "@/lib/permissions";
import { loadBoatAttention, loadWeekActivity, pickNames } from "@/lib/queries/attention";
import {
  boatPath,
  checklistPath,
  logPath,
  logsPath,
  newLogPath,
  stockPath,
  suppliesPath,
} from "@/lib/queries/boat-routes";
import { pendingInboxCount } from "@/lib/queries/inbox";
import { Button } from "@/components/ui/button";
import { completionContext } from "@/lib/queries/completion-context";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// 6 rows in landscape, the list itself hides the rest below `lg` (ux-flows §2.8).
const QUEUE_LIMIT = 6;
/** Trois lignes, pas cinq : l'historique complet est l'onglet Journal, à un tap d'ici. */
const RECENT_LIMIT = 3;
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
 * Les lignes complètes des points que la file a déjà classés. Le `select("*")` est voulu :
 * le dialogue « Fait » et le miroir optimiste (`applyCompletion`) lisent presque toute la
 * ligne, et il n'y en a jamais plus de six.
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
 * Tableau de bord (E7-1, D20): « is there a problem, and what do I do now? » in three
 * seconds. Header, one banner, the next act, the rest of the queue, the eight systems,
 * the last three interventions, one recap line.
 */
export default async function DashboardPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const today = todayString();
  const weekSince = toDateString(subDays(new Date(), WEEK_DAYS));

  /**
   * Une seule vague. Les colonnes sont nommées partout où le rendu ne les lit pas toutes :
   * `boat_dashboard_stats` porte une sous-requête par colonne, et celles qu'on ne demande
   * plus (dépenses de l'année, moteurs sans relevé) ne sont plus calculées. La lecture des
   * lignes de dépenses sur douze mois a disparu tout court : la vue en donne déjà le total.
   */
  const [
    { data: boat },
    { data: role },
    { data: stats },
    { data: engines },
    { data: hours },
    { data: queue },
    { data: progress },
    { data: recent },
    attention,
    week,
    inboxCount,
  ] = await Promise.all([
    supabase
      .from("boats")
      .select("name, builder, model, hull_number, type, checklist_template_id")
      .eq("id", boatId)
      .maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("boat_dashboard_stats")
      .select(
        "overdue_items, soon_items, planned_logs, in_progress_logs, urgent_logs, review_pending_logs, review_pending_purchases, expenses_12m, last_haul_out_at, months_since_haul_out, low_stock_parts",
      )
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
    supabase
      .from("checklist_category_progress")
      .select("*")
      .eq("boat_id", boatId)
      .order("sort_order"),
    supabase
      .from("maintenance_logs_view")
      .select(
        "id, title, performed_at, cost, contact_name, category_name, category_color, needs_review",
      )
      .eq("boat_id", boatId)
      .eq("status", "done")
      .order("performed_at", { ascending: false })
      .limit(RECENT_LIMIT),
    // Ce qui est à faire aujourd'hui : le même compte que les points rouges de la navigation,
    // pour que la tuile, la grille et l'onglet racontent la même chose (D88).
    loadBoatAttention(supabase, boatId, today),
    // Ce qui a été réglé sur sept jours : la phrase d'état et la 4ᵉ vignette.
    loadWeekActivity(supabase, boatId, weekSince),
    // Documents waiting on « À valider » (D91): a narrow count, read here rather than in the
    // view. It depends on nothing above, so it travels with the wave instead of after it.
    pendingInboxCount(supabase, boatId),
  ]);
  if (!boat || !role) notFound();
  const boatRole = role as BoatRole;
  const canWrite = can(boatRole, "write");
  const canContribute = can(boatRole, "contribute");

  const [t, tn, tc, tl, tb, tcreate] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("nav"),
    getTranslations("common"),
    getTranslations("logs"),
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

  // Systems and the « brand new » state
  const categories = (progress ?? []).map((row) =>
    toCategoryProgress(row, attention.dueTodayByCategory.get(row.category_id ?? "") ?? 0),
  );
  const totalInterval = categories.reduce((sum, category) => sum + category.total, 0);
  const neverRecorded = categories.reduce((sum, category) => sum + category.neverRecorded, 0);
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

  const overdue = stats?.overdue_items ?? 0;
  const soon = stats?.soon_items ?? 0;
  const urgent = stats?.urgent_logs ?? 0;
  const openLogs = (stats?.planned_logs ?? 0) + (stats?.in_progress_logs ?? 0) + urgent;
  /**
   * Une seule règle de comptage pour la file et son lien : ce que l'écran d'arrivée montre.
   *
   * Le lien annonçait `en retard + bientôt + jamais renseignés`, soit une addition de deux
   * ensembles qui se recouvrent — un point jamais renseigné est déjà compté par son état
   * (`never_recorded_count` compte l'absence de cochage, pas un état) — au-dessus d'une liste
   * de six lignes, et l'onglet « À traiter » d'en face, lui, liste `en retard + bientôt`.
   * C'est ce compte-là qui est écrit ici : la file en est le sommet, le lien en est le tout.
   */
  const todoCount = overdue + soon;
  const reviewCount = (stats?.review_pending_logs ?? 0) + (stats?.review_pending_purchases ?? 0);
  const lowStock = stats?.low_stock_parts ?? 0;
  const total12m = stats?.expenses_12m ?? 0;

  /**
   * La phrase d'état ne répète plus les deux vignettes qui la suivent de deux pouces : elle
   * dit ce qui a bougé depuis la dernière fois — ce qui a été réglé, par qui, et si quelque
   * chose est *devenu* en retard. « Tout est à jour » ne s'affichait qu'au moment où il n'y
   * avait plus aucune raison de revenir.
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

  const recentRows = recent ?? [];
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
      {/* 1 — dark header: identity, state, 4 tiles, engine strip */}
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

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            variant="dark"
            label={t("stats.overdue")}
            value={overdue}
            hint={t("stats.overdueHint")}
            tone={overdue > 0 ? "danger" : "default"}
            href={checklistPath(boatId, { view: "todo", filter: "overdue" })}
          />
          <StatCard
            variant="dark"
            label={t("stats.soon")}
            value={soon}
            hint={t("stats.soonHint")}
            tone={soon > 0 ? "warning" : "default"}
            href={checklistPath(boatId, { view: "todo", filter: "soon" })}
          />
          {/* Le rouge de la tuile suit ce qui est à faire aujourd'hui, pas le total ouvert :
              une intervention prévue dans trois semaines n'est pas une alerte (D88). */}
          <StatCard
            variant="dark"
            label={t("stats.openLogs")}
            value={openLogs}
            hint={
              attention.logs > 0
                ? t("stats.openLogsDue", { count: attention.logs })
                : t("stats.openLogsHint", { count: urgent })
            }
            tone={attention.logs > 0 ? "danger" : "default"}
            href={logsPath(boatId, { tab: "planned" })}
          />
          {/* La 4ᵉ vignette récompense au lieu de compter l'argent de l'année : ce qui a été
              réglé sur sept jours, cochages et interventions (AUDIT §6). Le total des dépenses
              reste au récapitulatif, où on va le chercher quand on le cherche. Elle ne mène
              nulle part : ses deux moitiés ont chacune leur porte ailleurs sur l'écran, et un
              lien qui n'en montrerait qu'une serait le compte faux d'à côté. */}
          <StatCard
            variant="dark"
            label={t("stats.settled")}
            value={week.total}
            hint={t("stats.settledHint", { items: week.completions, logs: week.logs })}
            tone={week.total > 0 ? "success" : "default"}
          />
        </div>

        <EngineStrip
          boatId={boatId}
          engines={engineList}
          canContribute={canContribute}
          canWrite={canWrite}
        />
      </header>

      {/* 2 bis — the dominant act, named, on the screen a cold start lands on (D35). From
          `lg` the sidebar already carries « Noter une intervention »: one named primary
          action per viewport, never two. */}
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

      {/* 2 — one contextual banner */}
      <DashboardBanner
        boatId={boatId}
        inboxCount={inboxCount}
        reviewCount={reviewCount}
        noReadingEngines={noReadingEngines}
        canContribute={canContribute}
        canWrite={canWrite}
        unfinished={unfinished}
      />

      {/* 3 — the next act, then the rest of the queue */}
      <SectionCard
        title={t("upcoming.title")}
        actionHref={checklistPath(boatId, { view: "todo" })}
        actionLabel={t("upcoming.allChecklist")}
        bare
      >
        <div className="flex flex-col gap-4">
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
              todoCount={todoCount}
              openLogs={openLogs}
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
      </SectionCard>

      {/* 4 — the eight systems, fixed order */}
      <SectionCard
        title={t("categories.title")}
        actionHref={checklistPath(boatId)}
        actionLabel={tn("checklist")}
        bare
      >
        <ChecklistGrid boatId={boatId} categories={categories} />
      </SectionCard>

      {/* 5 — what has just been done: three lines, the rest is the Journal tab */}
      <SectionCard
        title={t("recent.title")}
        actionHref={logsPath(boatId)}
        actionLabel={tn("logs")}
        bare={recentRows.length === 0}
      >
        {recentRows.length === 0 ? (
          /**
           * Une phrase, sans bouton. L'écran porte déjà « Noter une intervention » — nommé,
           * pleine largeur, au-dessus de la ligne de flottaison (D35) : un troisième contrôle
           * vers la même destination sur le même viewport n'ajoutait qu'un choix à faire.
           */
          <p className="text-body text-ink-2">{t("recent.empty")}</p>
        ) : (
          recentRows.map((log) => (
            <ListRow
              key={log.id ?? log.title ?? ""}
              categoryColor={log.category_color ?? undefined}
              lead={
                <span className="w-20 shrink-0 num text-caption text-ink-2">
                  {formatDate(log.performed_at)}
                </span>
              }
              title={log.title ?? ""}
              meta={
                <>
                  <span className="truncate">
                    {[log.category_name, log.contact_name ?? tl("byCrew")]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {log.needs_review ? (
                    <Badge size="sm" variant="secondary">
                      {tl("review.badge")}
                    </Badge>
                  ) : null}
                </>
              }
              trailing={
                <span className="num text-caption text-ink-2">
                  {log.cost === null ? tc("none") : formatCurrency(log.cost)}
                </span>
              }
              href={log.id ? logPath(boatId, log.id) : logsPath(boatId)}
            />
          ))
        )}
      </SectionCard>

      {/* 6 — one recap block. Three cards of quarterly data closed a weekly screen; the same
          three facts and the same three destinations now take three rows. */}
      <SectionCard title={t("recap.title")}>
        <ListRow
          title={t("recap.expenses12m")}
          trailing={<span className="num text-num-sm">{formatCurrency(total12m)}</span>}
          href={suppliesPath(boatId)}
        />
        <ListRow
          title={t("recap.haulOut")}
          meta={
            stats?.last_haul_out_at
              ? t("recap.lastHaulOut", {
                  date: formatDate(stats.last_haul_out_at),
                  months: Math.max(0, Math.round(stats.months_since_haul_out ?? 0)),
                })
              : t("recap.noHaulOut")
          }
          href={boatPath(boatId, "haulOuts")}
        />
        <ListRow
          title={t("recap.stock")}
          meta={lowStock > 0 ? t("recap.lowStock", { count: lowStock }) : t("recap.stockOk")}
          href={stockPath(boatId)}
        />
      </SectionCard>
    </div>
  );
}
