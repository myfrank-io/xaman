import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { NotebookPenIcon, PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { LogsList } from "@/components/logs/LogsList";
import { LogsToolbar, type LogsFilters } from "@/components/logs/LogsToolbar";
import { firstParam } from "@/components/logs/log-form-values";
import { toLogRow } from "@/components/logs/rows";
import { Button } from "@/components/ui/button";
import { can, type BoatRole } from "@/lib/permissions";
import {
  boatPath,
  importPath,
  logsPath,
  logsReviewPath,
  newLogPath,
} from "@/lib/queries/boat-routes";
import { LOG_STATUSES, type LogStatusValue } from "@/lib/schemas/logs";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const OPEN_STATUSES = ["planned", "in_progress", "urgent"] as const;

type Search = Record<string, string | string[] | undefined>;

// PostgREST splits an `or()` filter on commas and parentheses: a raw query would break it.
function sanitize(value: string): string {
  return value.replace(/[,()%*\\]/g, " ").trim();
}

function isLogStatus(value: string): value is LogStatusValue {
  return (LOG_STATUSES as readonly string[]).includes(value);
}

/**
 * Journal (E3-2): Historique / Prévu / Sorties de l'eau, search and filters kept in the URL,
 * 20 rows per page with an explicit « Charger plus » — never an infinite scroll on a list
 * people read backwards.
 */
export default async function LogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<Search>;
}) {
  const { boatId } = await params;
  const search = await searchParams;

  // The dashboard banner and the settings both point here (`?review=1`): that link opens the
  // guided review of the imported rows, not a filtered list.
  if (firstParam(search.review)) redirect(logsReviewPath(boatId) as Route);

  const supabase = await createClient();
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (!role) notFound();
  const boatRole = role as BoatRole;

  const tab = firstParam(search.tab) === "planned" ? "planned" : "history";
  const filters: LogsFilters = {
    tab,
    q: firstParam(search.q) ?? "",
    category: firstParam(search.category) ?? "",
    status: firstParam(search.status) ?? "",
    // `check` is the list filter; `review` is reserved for the guided review above.
    review: Boolean(firstParam(search.check)),
    contact: firstParam(search.contact) ?? "",
  };
  const limit = Math.min(Number(firstParam(search.limit) ?? PAGE_SIZE) || PAGE_SIZE, 500);
  const query = sanitize(filters.q);

  const columns =
    "id, boat_id, title, category_id, category_name, category_color, status, performed_at, cost, contact_name, needs_review, attachments_count, engine_hours, updated_at";

  let rowsQuery = supabase
    .from("maintenance_logs_view")
    .select(columns, { count: "exact" })
    .eq("boat_id", boatId);
  if (tab === "history") rowsQuery = rowsQuery.eq("status", "done");
  else rowsQuery = rowsQuery.in("status", [...OPEN_STATUSES]);
  if (filters.category) rowsQuery = rowsQuery.eq("category_id", filters.category);
  if (isLogStatus(filters.status)) rowsQuery = rowsQuery.eq("status", filters.status);
  if (filters.review) rowsQuery = rowsQuery.eq("needs_review", true);
  if (filters.contact) rowsQuery = rowsQuery.eq("contact_id", filters.contact);
  if (query) rowsQuery = rowsQuery.or(`title.ilike.%${query}%,notes.ilike.%${query}%`);

  const [{ data: rows, count }, { count: reviewCount }, { data: categories }, { data: contact }] =
    await Promise.all([
      tab === "history"
        ? rowsQuery
            .order("performed_at", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(limit)
        : rowsQuery.order("performed_at", { ascending: true }).limit(limit),
      supabase
        .from("maintenance_logs_view")
        .select("id", { count: "exact", head: true })
        .eq("boat_id", boatId)
        .eq("needs_review", true),
      supabase
        .from("boat_categories")
        .select("id, name, color, icon")
        .eq("boat_id", boatId)
        .eq("is_active", true)
        .order("sort_order"),
      filters.contact
        ? supabase.from("contacts").select("name").eq("id", filters.contact).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const list = (rows ?? []).map(toLogRow);
  // « Prévu »: what is urgent comes first, then the closest date (the view cannot order on an
  // enum by meaning).
  if (tab === "planned") {
    list.sort((a, b) => {
      const rank = (a.status === "urgent" ? 0 : 1) - (b.status === "urgent" ? 0 : 1);
      return rank !== 0 ? rank : a.performedAt.localeCompare(b.performedAt);
    });
  }

  const [t, tn, tc, ti] = await Promise.all([
    getTranslations("logs"),
    getTranslations("nav"),
    getTranslations("create"),
    getTranslations("import"),
  ]);
  const total = count ?? list.length;
  const filtered = Boolean(
    filters.q || filters.category || filters.status || filters.review || filters.contact,
  );
  const canContribute = can(boatRole, "contribute");
  // Importing writes whole rows: owner and editor only, like any other bulk write.
  const canWrite = can(boatRole, "write");

  const tabs: { key: "history" | "planned"; label: string; href: string }[] = [
    { key: "history", label: t("tabs.history"), href: logsPath(boatId) },
    { key: "planned", label: t("tabs.planned"), href: logsPath(boatId, { tab: "planned" }) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* The journal's own object, named and at the top right (D35). It replaces the bare
          « + » of the frame on this screen: reading the list is not the same gesture as
          adding to it, and the frame's control sits in the corner the eye reaches last.
          It wraps under the title on a phone rather than shrinking below 44 px. */}
      <PageHeader
        title={t("title")}
        subtitle={t("results", { count: total })}
        actions={
          canContribute ? (
            <>
              {/* Reprendre un carnet papier ou un export commence ici, à côté de l'acte du
                  quotidien : importer n'est pas un réglage, c'est une façon de saisir. */}
              {canWrite ? (
                <Button asChild variant="outline">
                  <Link href={importPath(boatId, "logs") as Route}>
                    <UploadIcon />
                    {ti("action")}
                  </Link>
                </Button>
              ) : null}
              <Button asChild size="xl">
                <Link href={newLogPath(boatId) as Route}>
                  <PlusIcon />
                  {tc("newLog")}
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((entry) => (
          <Link
            key={entry.key}
            href={entry.href as Route}
            aria-current={tab === entry.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center border-b-2 px-3 text-label font-medium",
              tab === entry.key
                ? "border-primary text-foreground"
                : "border-transparent text-ink-2",
            )}
          >
            {entry.label}
          </Link>
        ))}
        <Link
          href={boatPath(boatId, "haulOuts") as Route}
          className="inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-label font-medium text-ink-2"
        >
          {tn("haulOuts")}
        </Link>
      </div>

      <LogsToolbar
        boatId={boatId}
        filters={filters}
        categories={categories ?? []}
        reviewCount={reviewCount ?? 0}
        contactName={contact?.name ?? null}
        canContribute={canContribute}
      />

      {list.length === 0 ? (
        filtered ? (
          <EmptyState
            variant="filtered"
            icon={<SearchIcon />}
            title={
              filters.q ? t("emptyFiltered", { query: filters.q }) : t("results", { count: 0 })
            }
            action={
              <Button asChild variant="outline">
                <Link
                  href={
                    logsPath(boatId, { tab: tab === "planned" ? "planned" : undefined }) as Route
                  }
                >
                  {t("clearFilters")}
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<NotebookPenIcon />}
            title={tab === "planned" ? t("emptyPlannedTitle") : t("emptyTitle")}
            description={tab === "planned" ? t("emptyPlannedDescription") : t("emptyDescription")}
            action={
              canContribute && tab !== "planned" ? (
                <Button asChild>
                  <Link href={newLogPath(boatId) as Route}>
                    <PlusIcon />
                    {t("new")}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <LogsList boatId={boatId} rows={list} />
        </div>
      )}

      {list.length >= limit && total > list.length ? (
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link
              href={
                logsPath(boatId, {
                  tab: tab === "planned" ? "planned" : undefined,
                  q: filters.q || undefined,
                  category: filters.category || undefined,
                  status: filters.status || undefined,
                  check: filters.review ? 1 : undefined,
                  contact: filters.contact || undefined,
                  limit: limit + PAGE_SIZE,
                }) as Route
              }
            >
              {t("loadMore")}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
