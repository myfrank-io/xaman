import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PlusIcon, TriangleAlertIcon } from "lucide-react";

import type { ChecklistRow } from "@/components/checklist/rows";
import { SectionCard } from "@/components/common/SectionCard";
import { BrandNewBlock } from "@/components/dashboard/BrandNewBlock";
import { EngineStrip } from "@/components/dashboard/EngineStrip";
import type { UpcomingEntry } from "@/components/dashboard/queue";
import { UpcomingList } from "@/components/dashboard/UpcomingList";
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
import { Button } from "@/components/ui/button";
import { todayString } from "@/lib/format";

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
    engineTracksHours: true,
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

/**
 * La file entière, telle que `boat_todo_queue` la classe (rang 0 urgent, 1 en retard, 2 ouvertes,
 * 3 bientôt) — avec de quoi peupler les quatre paliers de `queue.ts` : aujourd'hui, cette
 * semaine, ce mois-ci, aux heures moteur.
 */
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
    kind: "item",
    row: sampleRow({
      id: "u7",
      label: "Gréement dormant (contrôle visuel)",
      categoryId: SAMPLE_CATEGORIES[2].id,
      categoryName: SAMPLE_CATEGORIES[2].name,
      categoryColor: SAMPLE_CATEGORIES[2].color,
      status: "soon",
      daysRemaining: 3,
    }),
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
  {
    kind: "log",
    id: "u5",
    title: "Révision radeau de survie",
    status: "planned",
    dueAt: "2026-10-15",
    categoryName: SAMPLE_CATEGORIES[7].name,
    categoryColor: SAMPLE_CATEGORIES[7].color,
  },
  // L'échéance qui ne tombe pas un jour : elle tombe quand on aura motorisé (palier « heures »).
  {
    kind: "item",
    row: sampleRow({
      id: "u8",
      label: "Filtre à gasoil (décanteur)",
      engineId: "sb",
      engineLabel: "Moteur SB",
      status: "soon",
      intervalHours: 250,
      currentHours: 1256,
      dueHours: 1274,
      daysRemaining: 300,
      hoursRemaining: 18,
    }),
  },
];

/** Ce qui a été réglé cette semaine : la phrase d'état lit cet objet. */
const WEEK = { completions: 3, logs: 1, total: 4, people: ["Xavier", "Emmanuel"] };

/** Static dashboard mock-up: visual acceptance in 1024×768 and 768×1024, no seed needed. */
export default async function DevDashboardPage() {
  if (!devUiEnabled()) notFound();

  const t = await getTranslations("dashboard");
  const tn = await getTranslations("nav");
  const td = await getTranslations("dev");
  const tcreate = await getTranslations("create");

  // Same assembly as the real screen: two clauses joined by the locale, never by a hard « et ».
  const list = new Intl.ListFormat("fr-FR", { style: "long", type: "conjunction" });
  const statePhrase = `${t("state.weekBy", {
    activity: list.format([
      t("state.weekItems", { count: WEEK.completions }),
      t("state.weekLogs", { count: WEEK.logs }),
    ]),
    names: list.format(WEEK.people),
  })} · ${t("state.noNewOverdue")}`;

  const keys: NavKey[] = [...PRIMARY_NAV_KEYS, ...SECONDARY_NAV_KEYS, ...ACCOUNT_NAV_KEYS];
  const badges: Partial<Record<NavKey, number>> = { checklist: 3, logs: 2 };
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
        {/* 1 — dark header: identity, what has moved, the engine strip */}
        <header className="-mx-4 -mt-3 bg-header-gradient px-4 pt-5 pb-4 text-on-navy sm:-mx-6 sm:-mt-4 sm:px-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-h1">Xaman</p>
              <p className="mt-0.5 num text-caption text-on-navy-2">
                ORC 50 #25 · Marsaudon Composites · Catamaran
              </p>
            </div>
            {/* La phrase d'état : ce qui a bougé cette semaine, pas des vignettes répétées. */}
            <p className="text-label text-on-navy-2">{statePhrase}</p>
          </div>

          <EngineStrip boatId={DEV_BOAT_ID} engines={ENGINES} canContribute canWrite />
        </header>

        {/* 2 — écrire : the dominant act, named, below `lg` (D35) */}
        <div className="lg:hidden">
          <Button asChild size="xl" className="w-full sm:w-auto">
            <Link href={`/boats/${DEV_BOAT_ID}/logs/new` as Route}>
              <PlusIcon />
              {tcreate("primary")}
            </Link>
          </Button>
        </div>

        {/* 3 — contextual banner (a single one, by priority) */}
        <Alert variant="warning" className="items-center">
          <TriangleAlertIcon />
          <AlertTitle className="flex flex-wrap items-center justify-between gap-3">
            {t("review.banner", { count: 7 })}
            <Button size="sm" variant="outline">
              {t("review.action")}
            </Button>
          </AlertTitle>
        </Alert>

        {/* 4 — faire : the whole queue, by tier. The screen is this list (D118). */}
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
          today={todayString()}
        />

        {/* 4b — day-one state of the same block */}
        <SectionCard title={td("dashboard.brandNew")} bare>
          <BrandNewBlock
            boatId={DEV_BOAT_ID}
            count={90}
            reviewCount={7}
            steps={{ hours: true, review: false, checklist: false }}
            hasCounters
            canContribute
          />
        </SectionCard>
      </div>
    </AppShell>
  );
}
