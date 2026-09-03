import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronRightIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";

import type { ChecklistRow } from "@/components/checklist/rows";
import { CategoryIcon } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BrandNewBlock } from "@/components/dashboard/BrandNewBlock";
import { EngineStrip } from "@/components/dashboard/EngineStrip";
import { UpcomingList, type UpcomingEntry } from "@/components/dashboard/UpcomingList";
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
import { formatCurrency, formatDate } from "@/lib/format";

import { SAMPLE_CATEGORIES } from "../sample-data";
import { devUiEnabled } from "@/lib/dev-ui";

const DEV_BOAT_ID = "00000000-0000-4000-8000-000000000000";

const ENGINES = [
  { id: "sb", label: "Moteur SB", lastHours: 1256, lastDate: "2026-08-28" },
  { id: "bb", label: "Moteur BB", lastHours: 1208, lastDate: "2026-05-02" },
  { id: "annex", label: "Annexe", lastHours: null, lastDate: null },
];

function sampleRow(over: Partial<ChecklistRow> & Pick<ChecklistRow, "id" | "label">): ChecklistRow {
  return {
    description: null,
    actions: [],
    categoryId: SAMPLE_CATEGORIES[0].id,
    categoryName: SAMPLE_CATEGORIES[0].name,
    categoryColor: SAMPLE_CATEGORIES[0].color,
    engineId: null,
    engineLabel: null,
    intervalMonths: 12,
    intervalHours: null,
    sortOrder: 1,
    anchorDate: null,
    anchorHours: null,
    counterResetAt: null,
    currentHours: null,
    hasCompletion: true,
    lastCompletionId: null,
    lastCompletedAt: "2026-03-06",
    lastCompletedByName: "Xavier",
    lastEngineHours: null,
    fixedDueAt: null,
    status: "overdue",
    dueAt: "2026-05-01",
    dueHours: null,
    daysRemaining: -126,
    hoursRemaining: null,
    ...over,
  };
}

// « À faire prochainement » — rank 0 urgent logs, 1 overdue items, 2 open logs, 3 soon items.
const UPCOMING: UpcomingEntry[] = [
  {
    kind: "log",
    id: "u1",
    title: "Fuite inverseur BB",
    status: "urgent",
    dueAt: "2026-08-29",
    categoryName: SAMPLE_CATEGORIES[0].name,
    categoryColor: SAMPLE_CATEGORIES[0].color,
  },
  {
    kind: "item",
    row: sampleRow({
      id: "u2",
      label: "Vidange huile + filtre à huile",
      engineId: "sb",
      engineLabel: "Moteur SB",
      intervalHours: 250,
      currentHours: 1256,
      lastEngineHours: 580,
      dueHours: 830,
      hoursRemaining: -426,
    }),
  },
  {
    kind: "item",
    row: sampleRow({
      id: "u3",
      label: "Enrouleur génois (roulements)",
      categoryId: SAMPLE_CATEGORIES[2].id,
      categoryName: SAMPLE_CATEGORIES[2].name,
      categoryColor: SAMPLE_CATEGORIES[2].color,
      lastCompletedAt: "2025-06-15",
      daysRemaining: -58,
    }),
  },
  {
    kind: "item",
    row: sampleRow({
      id: "u4",
      label: "Pompes de cale (test auto/manuel)",
      categoryId: SAMPLE_CATEGORIES[6].id,
      categoryName: SAMPLE_CATEGORIES[6].name,
      categoryColor: SAMPLE_CATEGORIES[6].color,
      intervalMonths: 6,
      daysRemaining: -12,
    }),
  },
  {
    kind: "log",
    id: "u5",
    title: "Révision radeau de survie",
    status: "planned",
    dueAt: "2026-10-15",
    categoryName: SAMPLE_CATEGORIES[7].name,
    categoryColor: SAMPLE_CATEGORIES[7].color,
  },
  {
    kind: "item",
    row: sampleRow({
      id: "u6",
      label: "Capteur loch (roue à aubes)",
      categoryId: SAMPLE_CATEGORIES[4].id,
      categoryName: SAMPLE_CATEGORIES[4].name,
      categoryColor: SAMPLE_CATEGORIES[4].color,
      status: "soon",
      daysRemaining: 9,
    }),
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
  if (!devUiEnabled()) notFound();

  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const tc = await getTranslations("common");
  const td = await getTranslations("dev");
  const tl = await getTranslations("logs");
  const tcreate = await getTranslations("create");

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
        <header className="-mx-4 bg-header-gradient px-4 pt-5 pb-4 text-on-navy sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 lg:pt-5">
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

          <EngineStrip boatId={DEV_BOAT_ID} engines={ENGINES} canContribute canWrite />
        </header>

        {/* 2 bis — the dominant act, named, below `lg` (D35) */}
        <div className="lg:hidden">
          <Button asChild size="xl" className="w-full sm:w-auto">
            <Link href={`/boats/${DEV_BOAT_ID}/logs/new` as Route}>
              <PlusIcon />
              {tcreate("primary")}
            </Link>
          </Button>
        </div>

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
          <UpcomingList
            boatId={DEV_BOAT_ID}
            entries={UPCOMING}
            members={[
              { id: "u-xav", name: "Xavier Marin" },
              { id: "u-emm", name: "Emmanuel Lesaffre" },
            ]}
            currentUserId="u-xav"
            currentUserName="Xavier Marin"
            canContribute
            todoCount={23}
            openLogs={2}
          />
        </SectionCard>

        {/* 3b — day-one state of the same block */}
        <SectionCard title={td("dashboard.brandNew")} bare>
          <BrandNewBlock
            boatId={DEV_BOAT_ID}
            count={90}
            reviewCount={7}
            steps={{ hours: true, review: false, checklist: false }}
            canContribute
          />
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
