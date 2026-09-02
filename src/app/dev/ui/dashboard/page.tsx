import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronRightIcon, GaugeIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";

import { CategoryBadge, CategoryIcon } from "@/components/common/CategoryBadge";
import { ChecklistStateBadge } from "@/components/common/ChecklistStateBadge";
import { DueLabel } from "@/components/common/DueLabel";
import { ListRow } from "@/components/common/ListRow";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { AppShell } from "@/components/layout/AppShell";
import { PrimaryActionSheet } from "@/components/layout/PrimaryActionSheet";
import {
  ACCOUNT_NAV_KEYS,
  PRIMARY_NAV_KEYS,
  SECONDARY_NAV_KEYS,
  type NavItem,
  type NavKey,
} from "@/components/layout/nav";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatDayMonth, formatHours } from "@/lib/format";

import { SAMPLE_CATEGORIES } from "../sample-data";

const DEV_BOAT_ID = "00000000-0000-4000-8000-000000000000";

const ENGINES = [
  { id: "sb", name: "Moteur SB", hours: 1256, readAt: "2026-08-28", stale: false },
  { id: "bb", name: "Moteur BB", hours: 1208, readAt: "2026-08-28", stale: false },
  { id: "annex", name: "Annexe", hours: null, readAt: null, stale: false },
] as const;

// « À faire prochainement » — rank 0 urgent logs, 1 overdue items, 2 open logs, 3 soon items.
const UPCOMING = [
  {
    id: "u1",
    kind: "log" as const,
    status: "urgent" as const,
    title: "Fuite inverseur BB",
    category: SAMPLE_CATEGORIES[0],
    trailing: "depuis 4 j",
  },
  {
    id: "u2",
    kind: "item" as const,
    state: "overdue" as const,
    title: "Vidange huile + filtre — Moteur SB",
    category: SAMPLE_CATEGORIES[0],
    days: -126,
  },
  {
    id: "u3",
    kind: "item" as const,
    state: "overdue" as const,
    title: "Enrouleur génois (roulements)",
    category: SAMPLE_CATEGORIES[2],
    days: -58,
  },
  {
    id: "u4",
    kind: "item" as const,
    state: "overdue" as const,
    title: "Pompes de cale (test auto/manuel)",
    category: SAMPLE_CATEGORIES[6],
    days: -12,
  },
  {
    id: "u5",
    kind: "log" as const,
    status: "planned" as const,
    title: "Révision radeau de survie",
    category: SAMPLE_CATEGORIES[7],
    trailing: "15/10/2026",
  },
  {
    id: "u6",
    kind: "item" as const,
    state: "soon" as const,
    title: "Capteur loch (roue à aubes)",
    category: SAMPLE_CATEGORIES[4],
    days: 9,
  },
];

const SYSTEMS = [
  { category: SAMPLE_CATEGORIES[0], total: 13, ratio: 0.4, overdue: 3 },
  { category: SAMPLE_CATEGORIES[1], total: 6, ratio: null, overdue: 0 },
  { category: SAMPLE_CATEGORIES[2], total: 23, ratio: 0.85, overdue: 1 },
  { category: SAMPLE_CATEGORIES[3], total: 12, ratio: 1, overdue: 0 },
  { category: SAMPLE_CATEGORIES[4], total: 10, ratio: 0.55, overdue: 1 },
  { category: SAMPLE_CATEGORIES[5], total: 7, ratio: 0.7, overdue: 0 },
  { category: SAMPLE_CATEGORIES[6], total: 10, ratio: 0.3, overdue: 2 },
  { category: SAMPLE_CATEGORIES[7], total: 9, ratio: 0.8, overdue: 1 },
];

const RECENT = [
  { id: "r1", date: "2026-03-25", title: "Niveaux + courroie", cost: null },
  { id: "r2", date: "2026-03-06", title: "Vidange + entretien complet (2 moteurs)", cost: 620 },
  { id: "r3", date: "2025-12-30", title: "Niveaux + check", cost: null },
  { id: "r4", date: "2025-10-20", title: "Niveaux + liquide de refroidissement", cost: null },
  { id: "r5", date: "2025-08-28", title: "Check niveaux", cost: null },
];

const EXPENSES = [
  { category: SAMPLE_CATEGORIES[0], amount: 2480, ratio: 1 },
  { category: SAMPLE_CATEGORIES[3], amount: 1200, ratio: 0.48 },
  { category: SAMPLE_CATEGORIES[7], amount: 641, ratio: 0.26 },
];

/** Static dashboard mock-up: visual acceptance in 1024×768 and 768×1024, no seed needed. */
export default async function DevDashboardPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("common");
  const td = await getTranslations("dev");
  const tch = await getTranslations("checklist");
  const tl = await getTranslations("logs");

  const keys: NavKey[] = [...PRIMARY_NAV_KEYS, ...SECONDARY_NAV_KEYS, ...ACCOUNT_NAV_KEYS];
  const badges: Partial<Record<NavKey, number>> = { checklist: 3, logs: 2, trash: 4 };
  const nav: NavItem[] = keys.map((key) => ({
    key,
    href: key === "dashboard" ? "/dev/ui/dashboard" : `/boats/${DEV_BOAT_ID}/${key}`,
    label: tn(key),
    shortLabel: tn(`short.${key}`),
    badge: badges[key],
  }));

  return (
    <AppShell
      boatName={td("sample.boatName")}
      boatSubtitle="Marsaudon Composites ORC 50"
      nav={nav}
      primaryAction={<PrimaryActionSheet boatId={DEV_BOAT_ID} role="owner" />}
      accountMenu={
        <AccountMenu
          boatId={DEV_BOAT_ID}
          role="owner"
          user={{ name: "Xavier Marin", email: "xavier@exemple.fr" }}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* 1 — dark header: identity, 4 tiles, engine strip */}
        <header className="-mx-4 -mt-4 bg-header-gradient px-4 pt-5 pb-4 text-on-navy sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-h1">Xaman</p>
              <p className="mt-0.5 num text-caption text-on-navy-2">
                ORC 50 #25 · Marsaudon Composites · Catamaran
              </p>
            </div>
            {/* The role already shows in the account row below `lg`. */}
            <p className="hidden text-caption text-on-navy-3 sm:block">Xavier · Propriétaire</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              variant="dark"
              label={t("stats.overdue")}
              value="3"
              hint={t("stats.overdueHint")}
              tone="danger"
              href="/dev/ui/dashboard"
            />
            <StatCard
              variant="dark"
              label={t("stats.soon")}
              value="5"
              hint={t("stats.soonHint")}
              tone="warning"
              href="/dev/ui/dashboard"
            />
            <StatCard
              variant="dark"
              label={t("stats.openLogs")}
              value="2"
              hint={t("stats.openLogsHint", { count: 1 })}
              href="/dev/ui/dashboard"
            />
            <StatCard
              variant="dark"
              label={t("stats.expenses", { year: 2026 })}
              value={formatCurrency(4321.5)}
              hint={t("stats.expensesHint", { count: 12 })}
              href="/dev/ui/dashboard"
            />
          </div>

          {/* Engine strip: a tappable chip per engine → hour reading dialog */}
          <div className="mt-3 flex items-center gap-2">
            <span className="shrink-0 text-overline text-on-navy-3 uppercase">
              {t("engines.title")}
            </span>
            {/* Phone: one scrollable row rather than three stacked chips. */}
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible">
              {ENGINES.map((engine) => (
                <button
                  key={engine.id}
                  type="button"
                  className="inline-flex min-h-11 shrink-0 pressable items-center gap-2 rounded-lg border border-on-navy-border bg-on-navy-surface px-3 text-label text-on-navy"
                >
                  <GaugeIcon className="size-4 shrink-0 text-on-navy-3" aria-hidden />
                  <span className="font-medium">{engine.name}</span>
                  {engine.hours === null ? (
                    <span className="text-on-navy-3">{t("engines.noReading")}</span>
                  ) : (
                    <span className="num">
                      {formatHours(engine.hours)} · {formatDayMonth(engine.readAt)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <Button variant="inverse" size="icon" aria-label={tc("add")} className="shrink-0">
              <PlusIcon />
            </Button>
          </div>
        </header>

        {/* 2 — contextual banner (a single one, by priority) */}
        <Alert variant="warning" className="items-center">
          <TriangleAlertIcon />
          <AlertTitle className="flex flex-wrap items-center justify-between gap-3">
            {t("review.banner", { count: 7 })}
            <Button size="sm" variant="outline">
              {t("review.action")}
            </Button>
          </AlertTitle>
        </Alert>

        {/* 3 — the work queue */}
        <SectionCard
          title={t("upcoming.title")}
          actionHref="/dev/ui/dashboard"
          actionLabel={t("upcoming.allChecklist")}
        >
          {UPCOMING.map((row) => (
            <ListRow
              key={row.id}
              size="lg"
              categoryColor={row.category.color}
              lead={
                row.kind === "log" ? (
                  <StatusBadge status={row.status} size="sm" />
                ) : (
                  <ChecklistStateBadge state={row.state} size="sm" />
                )
              }
              title={row.title}
              meta={
                <CategoryBadge
                  name={row.category.name}
                  color={row.category.color}
                  icon={row.category.icon}
                  withIcon
                  size="sm"
                  variant="inline"
                />
              }
              trailing={
                row.kind === "item" ? (
                  <DueLabel status={row.state} daysRemaining={row.days} />
                ) : (
                  <span className="num text-caption text-ink-2">{row.trailing}</span>
                )
              }
              action={
                row.kind === "item" ? (
                  <Button size="sm" variant="outline" className="min-w-22">
                    {tch("markDone")}
                  </Button>
                ) : undefined
              }
              href={row.kind === "log" ? "/dev/ui/dashboard" : undefined}
            />
          ))}
        </SectionCard>

        {/* 4 — the 8 systems, fixed order (sort_order), never re-sorted by urgency */}
        <SectionCard
          title={t("categories.title")}
          actionHref="/dev/ui/dashboard"
          actionLabel={tn("checklist")}
          bare
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SYSTEMS.map(({ category, total, ratio, overdue }) => (
              <div
                key={category.id}
                className="flex min-h-30 flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                {/* Icon on its own line: at 4 columns a 17 px name has no room next to it. */}
                <div className="flex items-start justify-between gap-2">
                  <CategoryIcon color={category.color} icon={category.icon} />
                  {overdue > 0 ? (
                    <Badge size="sm" className="border-transparent bg-state-overdue-fg text-white">
                      {t("categories.overdue", { count: overdue })}
                    </Badge>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-body font-semibold">{category.name}</p>
                <ProgressBar
                  ratio={ratio}
                  color={category.color}
                  label={category.name}
                  className="mt-auto"
                />
                <p className="text-caption text-ink-2">
                  <span className="num">{t("categories.summary", { count: total })}</span>
                  {overdue === 0 ? (
                    <span>
                      {" "}
                      · {ratio === null ? t("categories.neverDone") : t("categories.upToDate")}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 5 — what has just been done */}
        <SectionCard
          title={t("recent.title")}
          actionHref="/dev/ui/dashboard"
          actionLabel={tn("logs")}
        >
          {RECENT.map((log) => (
            <ListRow
              key={log.id}
              categoryColor={SAMPLE_CATEGORIES[0].color}
              lead={
                <span className="w-20 shrink-0 num text-caption text-ink-2">
                  {formatDate(log.date)}
                </span>
              }
              title={log.title}
              meta={
                <>
                  <StatusBadge status="done" size="sm" />
                  <Badge size="sm" variant="secondary">
                    {tl("review.badge")}
                  </Badge>
                </>
              }
              trailing={
                <span className="num text-caption text-ink-2">
                  {log.cost === null ? tc("none") : formatCurrency(log.cost)}
                </span>
              }
              href="/dev/ui/dashboard"
            />
          ))}
        </SectionCard>

        {/* 6 — management recap */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title={t("recap.expenses", { year: 2026 })} bare>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
              <p className="num text-num-md font-semibold">{formatCurrency(4321.5)}</p>
              {EXPENSES.map(({ category, amount, ratio }) => (
                <div key={category.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-caption text-ink-2">{category.name}</span>
                    <span className="shrink-0 num text-num-sm">{formatCurrency(amount)}</span>
                  </div>
                  <ProgressBar
                    ratio={ratio}
                    color={category.color}
                    label={category.name}
                    showValue={false}
                  />
                </div>
              ))}
              <a
                href="/dev/ui/dashboard"
                className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-primary"
              >
                {t("recap.expensesDetail")}
                <ChevronRightIcon className="size-4" aria-hidden />
              </a>
            </div>
          </SectionCard>

          <SectionCard title={t("recap.haulOut")} bare>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
              <p className="num text-body">
                {t("recap.lastHaulOut", { date: "12/2024", months: 14 })}
              </p>
              <Button variant="outline" className="w-fit">
                <PlusIcon />
                {tc("add")}
              </Button>
              <hr className="border-border" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-body">{t("recap.lowStock", { count: 2 })}</p>
                <a
                  href="/dev/ui/dashboard"
                  className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-primary"
                >
                  {t("recap.stock")}
                  <ChevronRightIcon className="size-4" aria-hidden />
                </a>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
