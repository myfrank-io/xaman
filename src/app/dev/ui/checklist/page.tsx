import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CategoryItems, type CompletionRow } from "@/components/checklist/CategoryItems";
import { ChecklistGrid, type CategoryProgress } from "@/components/checklist/ChecklistGrid";
import { TodoList } from "@/components/checklist/TodoList";
import type { ChecklistRow } from "@/components/checklist/rows";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { devUiEnabled } from "@/lib/dev-ui";

import { DevShell } from "../DevShell";
import { SAMPLE_CATEGORIES } from "../sample-data";

const DEV_BOAT_ID = "00000000-0000-4000-8000-000000000000";
const MEMBERS = [
  { id: "u-xav", name: "Xavier Marin" },
  { id: "u-emm", name: "Emmanuel Lesaffre" },
];

const PROGRESS: CategoryProgress[] = SAMPLE_CATEGORIES.map((category, index) => ({
  id: category.id,
  name: category.name,
  color: category.color,
  icon: category.icon,
  total: [13, 6, 23, 12, 10, 7, 10, 9][index] ?? 8,
  overdue: [3, 0, 1, 0, 1, 0, 2, 1][index] ?? 0,
  neverRecorded: index === 1 ? 6 : ([2, 0, 4, 1, 3, 1, 5, 2][index] ?? 0),
  punctual: index === 3 ? 2 : 0,
  progress: index === 1 ? null : ([0.4, null, 0.85, 1, 0.55, 0.7, 0.3, 0.8][index] ?? 0.5),
}));

const SAILS = SAMPLE_CATEGORIES[2];

function row(over: Partial<ChecklistRow> & Pick<ChecklistRow, "id" | "label">): ChecklistRow {
  return {
    description: null,
    actions: [],
    categoryId: SAILS.id,
    categoryName: SAILS.name,
    categoryColor: SAILS.color,
    engineId: null,
    engineLabel: null,
    intervalMonths: 12,
    intervalHours: null,
    sortOrder: 1,
    anchorDate: "2026-09-02",
    anchorHours: null,
    counterResetAt: null,
    currentHours: null,
    hasCompletion: true,
    lastCompletionId: null,
    lastCompletedAt: "2026-03-10",
    lastCompletedByName: "Emmanuel",
    lastEngineHours: null,
    fixedDueAt: null,
    status: "ok",
    dueAt: "2027-03-10",
    dueHours: null,
    daysRemaining: 189,
    hoursRemaining: null,
    ...over,
  };
}

const ROWS: ChecklistRow[] = [
  row({
    id: "s1",
    label: "Enrouleur génois (roulements)",
    status: "overdue",
    lastCompletedAt: "2025-06-15",
    lastCompletedByName: "Xavier",
    dueAt: "2026-06-15",
    daysRemaining: -79,
    sortOrder: 1,
  }),
  row({
    id: "s2",
    label: "Grand-voile (coutures, lattes, œillets)",
    status: "soon",
    intervalMonths: 6,
    dueAt: "2026-09-10",
    daysRemaining: 8,
    sortOrder: 2,
  }),
  row({
    id: "s3",
    label: "Winch GV SB — démontage, nettoyage, graissage",
    status: "never",
    hasCompletion: false,
    lastCompletedAt: null,
    lastCompletedByName: null,
    dueAt: "2027-09-02",
    daysRemaining: 365,
    sortOrder: 3,
    actions: [
      "Déposer le tambour et la cloche",
      "Nettoyer au pétrole, brosser les cliquets",
      "Vérifier l'usure des cliquets et des ressorts",
      "Graisser (graisse winch) — huiler les cliquets, jamais de graisse",
      "Remonter et tester les deux vitesses",
    ],
  }),
  row({
    id: "s4",
    label: "Foc / Génois (coutures, lattes)",
    intervalMonths: 6,
    dueAt: "2026-09-10",
    daysRemaining: 8,
    status: "soon",
    sortOrder: 4,
  }),
  row({
    id: "s5",
    label: "Haubans textiles : contrôle visuel des terminaisons",
    status: "ok",
    intervalMonths: 6,
    lastCompletedAt: "2026-08-20",
    dueAt: "2027-02-20",
    daysRemaining: 171,
    sortOrder: 5,
  }),
  row({
    id: "s6",
    label: "Remplacement du guindant du Code 0",
    intervalMonths: null,
    hasCompletion: false,
    lastCompletedAt: null,
    lastCompletedByName: null,
    status: "never",
    dueAt: null,
    daysRemaining: null,
    sortOrder: 6,
  }),
];

const COMPLETIONS: CompletionRow[] = [
  {
    id: "c1",
    itemId: "s1",
    completedAt: "2025-06-15",
    completedByName: "Xavier",
    engineHours: null,
    nextDueAt: null,
    note: "Roulements remplacés, bague neuve",
    createdBy: "u-xav",
    createdAt: "2025-06-15T10:00:00Z",
  },
  {
    id: "c2",
    itemId: "s5",
    completedAt: "2026-08-20",
    completedByName: "Emmanuel",
    engineHours: null,
    nextDueAt: null,
    note: null,
    createdBy: "u-emm",
    createdAt: "2026-08-20T09:00:00Z",
  },
];

/** Checklist screens with sample data: the grid, the flat queue and one category. */
export default async function DevChecklistPage() {
  if (!devUiEnabled()) notFound();
  const t = await getTranslations("checklist");
  return (
    <DevShell>
      <div className="flex flex-col gap-10">
        <PageHeader title={t("title")} />
        <ChecklistGrid boatId={DEV_BOAT_ID} categories={PROGRESS} />
        <SectionCard title={t("filters.todo")} bare>
          <TodoList
            boatId={DEV_BOAT_ID}
            rows={ROWS}
            filter="all"
            members={MEMBERS}
            currentUserId="u-xav"
            currentUserName="Xavier Marin"
            canContribute
          />
        </SectionCard>
        <CategoryItems
          boatId={DEV_BOAT_ID}
          category={{ id: SAILS.id, name: SAILS.name, color: SAILS.color, icon: SAILS.icon }}
          rows={ROWS}
          completions={COMPLETIONS}
          disabledItems={[{ id: "d1", label: "Spi symétrique (vendu)" }]}
          progress={0.85}
          members={MEMBERS}
          currentUserId="u-xav"
          currentUserName="Xavier Marin"
          canWrite
          canContribute
          filter="all"
        />
      </div>
    </DevShell>
  );
}
