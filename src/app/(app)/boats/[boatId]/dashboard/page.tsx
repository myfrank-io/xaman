import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { subMonths } from "date-fns";
import { AnchorIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ChecklistGrid, toCategoryProgress } from "@/components/checklist/ChecklistGrid";
import { toChecklistRow, type StatusViewRow } from "@/components/checklist/rows";
import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { BrandNewBlock } from "@/components/dashboard/BrandNewBlock";
import { OutboxCard } from "@/components/offline/OutboxCard";
import { DashboardBanner } from "@/components/dashboard/DashboardBanner";
import { EngineStrip } from "@/components/dashboard/EngineStrip";
import { UpcomingList, type UpcomingEntry } from "@/components/dashboard/UpcomingList";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, toDateString, todayString } from "@/lib/format";
import { can, type BoatRole } from "@/lib/permissions";
import {
  boatPath,
  checklistPath,
  logPath,
  logsPath,
  newLogPath,
  stockPath,
  suppliesPath,
} from "@/lib/queries/boat-routes";
import { Button } from "@/components/ui/button";
import { completionContext } from "@/lib/queries/completion-context";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// 6 rows in landscape, the list itself hides the rest below `lg` (ux-flows §2.8).
const QUEUE_LIMIT = 6;
const RECENT_LIMIT = 5;
const TOP_EXPENSES = 3;
const FALLBACK_COLOR = "#63748A";

type LogStatus = Database["public"]["Enums"]["log_status"];

const linkClass =
  "mt-auto inline-flex min-h-11 items-center gap-1 text-label font-medium text-primary";

/**
 * Tableau de bord (E7-1, D20): « is there a problem, and what do I do now? » in three
 * seconds. Header, one banner, the work queue, the eight systems, recent logs, recap.
 */
export default async function DashboardPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const today = todayString();
  const year = Number(today.slice(0, 4));
  const since = toDateString(subMonths(new Date(), 12));

  const [
    { data: boat },
    { data: role },
    { data: stats },
    { data: engines },
    { data: hours },
    { data: queue },
    { data: progress },
    { data: recent },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("boats")
      .select("name, builder, model, hull_number, type")
      .eq("id", boatId)
      .maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase.from("boat_dashboard_stats").select("*").eq("boat_id", boatId).maybeSingle(),
    supabase
      .from("engines")
      .select("id, label")
      .eq("boat_id", boatId)
      .eq("is_active", true)
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
    supabase
      .from("expenses_by_category")
      .select("category_id, category_name, category_color, amount, date")
      .eq("boat_id", boatId)
      .gte("date", since),
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

  // The queue, completed with the full status rows so « Fait » works inline
  const queueRows = queue ?? [];
  const itemIds = queueRows.filter((row) => row.kind === "item").map((row) => row.id);
  let statusRows: StatusViewRow[] = [];
  if (itemIds.length > 0) {
    const { data } = await supabase
      .from("checklist_item_status")
      .select("*")
      .eq("boat_id", boatId)
      .in("id", itemIds);
    statusRows = data ?? [];
  }
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

  // Systems and the « brand new » state
  const categories = (progress ?? []).map(toCategoryProgress);
  const totalInterval = categories.reduce((sum, category) => sum + category.total, 0);
  const neverRecorded = categories.reduce((sum, category) => sum + category.neverRecorded, 0);
  const brandNew = totalInterval > 0 && neverRecorded === totalInterval;

  const overdue = stats?.overdue_items ?? 0;
  const soon = stats?.soon_items ?? 0;
  const urgent = stats?.urgent_logs ?? 0;
  const openLogs = (stats?.planned_logs ?? 0) + (stats?.in_progress_logs ?? 0) + urgent;
  const todoCount = overdue + soon + neverRecorded;
  const reviewCount = (stats?.review_pending_logs ?? 0) + (stats?.review_pending_purchases ?? 0);
  const lowStock = stats?.low_stock_parts ?? 0;

  // Expenses: the year for the tile, twelve months for the recap
  const expenseRows = expenses ?? [];
  const ytdRows = expenseRows.filter((row) => (row.date ?? "") >= `${year}-01-01`);
  const ytdTotal = stats?.ytd_expenses ?? ytdRows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const total12m = expenseRows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const byCategory = new Map<string, { name: string; color: string; amount: number }>();
  for (const row of expenseRows) {
    const key = row.category_id ?? "other";
    const current = byCategory.get(key) ?? {
      name: row.category_name ?? t("recap.other"),
      color: row.category_color ?? FALLBACK_COLOR,
      amount: 0,
    };
    current.amount += row.amount ?? 0;
    byCategory.set(key, current);
  }
  const topExpenses = [...byCategory.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOP_EXPENSES);
  const topMax = topExpenses[0]?.amount ?? 0;

  // « Tout est à jour »: the next deadline, so the empty state says something true
  let nextDue: { label: string; days: number | null; hours: number | null } | null = null;
  if (entries.length === 0 && !brandNew) {
    const { data } = await supabase
      .from("checklist_item_status")
      .select("label, days_remaining, hours_remaining")
      .eq("boat_id", boatId)
      .eq("status", "ok")
      .order("days_remaining", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      nextDue = { label: data.label ?? "", days: data.days_remaining, hours: data.hours_remaining };
    }
  }

  const context =
    canContribute && entries.some((entry) => entry.kind === "item")
      ? await completionContext(supabase, boatId)
      : { members: [], currentUserId: "", currentUserName: "" };

  const stateParts: string[] = [];
  if (overdue > 0) stateParts.push(t("state.overdue", { count: overdue }));
  if (soon > 0) stateParts.push(t("state.soon", { count: soon }));
  const statePhrase =
    stateParts.length > 0
      ? stateParts.join(" · ")
      : brandNew
        ? t("state.new", { count: totalInterval })
        : t("state.ok");
  const subtitle = [
    [boat.model, boat.hull_number ? `#${boat.hull_number}` : null].filter(Boolean).join(" "),
    boat.builder,
    tb(boat.type),
  ]
    .filter(Boolean)
    .join(" · ");

  const recentRows = recent ?? [];
  const nextDueText = nextDue
    ? nextDue.days !== null
      ? t("upcoming.emptyNext", { label: nextDue.label, days: Math.max(nextDue.days, 0) })
      : nextDue.hours !== null
        ? t("upcoming.emptyNextHours", { label: nextDue.label, hours: Math.round(nextDue.hours) })
        : undefined
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* 0 — what is on the iPad and not yet on the server comes before anything else (E9-1b) */}
      <OutboxCard boatId={boatId} />
      {/* 1 — dark header: identity, state, 4 tiles, engine strip */}
      {/* Bleeds to all three edges: the dashboard carries no trail (see `buildTrail`), so there
          is nothing above for this band to paint over — which is what it used to do. */}
      <header className="-mx-4 -mt-3 bg-header-gradient px-4 pt-5 pb-4 text-on-navy sm:-mx-6 sm:-mt-4 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-5">
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
          <StatCard
            variant="dark"
            label={t("stats.openLogs")}
            value={openLogs}
            hint={t("stats.openLogsHint", { count: urgent })}
            tone={urgent > 0 ? "danger" : "default"}
            href={logsPath(boatId)}
          />
          <StatCard
            variant="dark"
            label={t("stats.expenses", { year })}
            value={formatCurrency(ytdTotal)}
            hint={t("stats.expensesHint", { count: ytdRows.length })}
            href={suppliesPath(boatId, undefined, { period: "year" })}
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
        reviewCount={reviewCount}
        noReadingEngines={noReadingEngines}
        canContribute={canContribute}
      />

      {/* 3 — the work queue */}
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
              canContribute={canContribute}
            />
          ) : null}
          {entries.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <UpcomingList
                boatId={boatId}
                entries={entries}
                members={context.members}
                currentUserId={context.currentUserId}
                currentUserName={context.currentUserName}
                canContribute={canContribute}
                todoCount={todoCount}
                openLogs={openLogs}
              />
            </div>
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

      {/* 5 — what has just been done */}
      <SectionCard
        title={t("recent.title")}
        actionHref={logsPath(boatId)}
        actionLabel={tn("logs")}
        bare={recentRows.length === 0}
      >
        {recentRows.length === 0 ? (
          // An empty state that invites the act instead of stating a lack (ux-flows §5.1).
          <div className="flex flex-col items-start gap-3">
            <p className="text-body text-ink-2">{t("recent.empty")}</p>
            {canContribute ? (
              <Button asChild variant="outline">
                <Link href={newLogPath(boatId) as Route}>
                  <PlusIcon />
                  {tcreate("primary")}
                </Link>
              </Button>
            ) : null}
          </div>
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

      {/* 6 — management recap */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard title={t("recap.expenses12m")} bare>
          <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="num text-num-md font-semibold">{formatCurrency(total12m)}</p>
            {topExpenses.length === 0 ? (
              <p className="text-body text-ink-2">{t("recap.noExpenses")}</p>
            ) : (
              topExpenses.map((row) => (
                <div key={row.name} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-caption text-ink-2">{row.name}</span>
                    <span className="shrink-0 num text-num-sm">{formatCurrency(row.amount)}</span>
                  </div>
                  <ProgressBar
                    ratio={topMax > 0 ? row.amount / topMax : 0}
                    color={row.color}
                    label={row.name}
                    showValue={false}
                  />
                </div>
              ))
            )}
            <Link href={suppliesPath(boatId) as Route} className={linkClass}>
              {t("recap.expensesDetail")}
              <ChevronRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
        </SectionCard>

        <SectionCard title={t("recap.haulOut")} bare>
          <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="num text-body">
              {stats?.last_haul_out_at
                ? t("recap.lastHaulOut", {
                    date: formatDate(stats.last_haul_out_at),
                    months: Math.max(0, Math.round(stats.months_since_haul_out ?? 0)),
                  })
                : t("recap.noHaulOut")}
            </p>
            <Link href={boatPath(boatId, "haulOuts") as Route} className={linkClass}>
              {t("recap.haulOutDetail")}
              <ChevronRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
        </SectionCard>

        <SectionCard title={t("recap.stock")} bare>
          <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <p className="text-body">
              {lowStock > 0 ? t("recap.lowStock", { count: lowStock }) : t("recap.stockOk")}
            </p>
            <Link href={stockPath(boatId) as Route} className={linkClass}>
              {t("recap.stockDetail")}
              <ChevronRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
