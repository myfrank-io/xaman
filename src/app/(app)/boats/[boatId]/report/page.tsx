import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { subMonths, addMonths } from "date-fns";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { ReportPrintButton } from "@/components/settings/ReportPrintButton";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatHours, formatPercent, toDateString } from "@/lib/format";
import { reportPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const DUE_LIMIT = 60;
const LOGS_LIMIT = 100;
const HAUL_OUTS_LIMIT = 5;

const table = "w-full border-collapse text-sm";
const th =
  "border-b border-border py-2 pr-3 text-left text-caption font-semibold text-ink-2 uppercase";
const td = "border-b border-border py-2 pr-3 align-top";
const num = "num text-right whitespace-nowrap";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex break-inside-avoid flex-col gap-3">
      <h2 className="text-h2">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Printable state report (E9-2b, D-O1): the deliverable to show an insurer, a buyer or a
 * surveyor. Server-rendered, tables only, `@media print` hides the app shell (AppShell).
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ costs?: string }>;
}) {
  const [{ boatId }, { costs }] = await Promise.all([params, searchParams]);
  const showCosts = costs !== "0";
  const supabase = await createClient();
  const today = toDateString(new Date());
  const since = toDateString(subMonths(new Date(), 12));
  const until = toDateString(addMonths(new Date(), 12));

  const [
    { data: boat },
    { data: role },
    { data: engines },
    { data: hours },
    { data: progress },
    { data: due },
    { data: logs },
    { data: haulOuts },
    { count: logsCount },
    { count: completionsCount },
  ] = await Promise.all([
    supabase.from("boats").select("*").eq("id", boatId).maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("engines")
      .select("id, label, brand, model, position")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("engine_current_hours").select("engine_id, hours, read_at").eq("boat_id", boatId),
    supabase
      .from("checklist_category_progress")
      .select("*")
      .eq("boat_id", boatId)
      .order("sort_order"),
    supabase
      .from("checklist_item_status")
      .select("id, label, category_id, status, due_at, due_hours, days_remaining, hours_remaining")
      .eq("boat_id", boatId)
      .in("status", ["overdue", "soon", "ok"])
      .or(`due_at.lte.${until},status.in.(overdue,soon)`)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(DUE_LIMIT),
    supabase
      .from("maintenance_logs_view")
      .select("id, performed_at, title, category_name, contact_name, cost")
      .eq("boat_id", boatId)
      .eq("status", "done")
      .gte("performed_at", since)
      .order("performed_at", { ascending: false })
      .limit(LOGS_LIMIT),
    supabase
      .from("haul_outs")
      .select("id, started_at, ended_at, yard_name, works, cost")
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(HAUL_OUTS_LIMIT),
    supabase
      .from("maintenance_logs")
      .select("id", { count: "exact", head: true })
      .eq("boat_id", boatId)
      .is("deleted_at", null),
    supabase
      .from("checklist_completions")
      .select("id", { count: "exact", head: true })
      .eq("boat_id", boatId),
  ]);
  if (!boat || !role) notFound();

  const [t, tb, ts, tp] = await Promise.all([
    getTranslations("report"),
    getTranslations("boatType"),
    getTranslations("checklistState"),
    getTranslations("enginePosition"),
  ]);
  const hoursByEngine = new Map((hours ?? []).map((row) => [row.engine_id, row]));
  const categoryNames = new Map(
    (progress ?? []).map((row) => [row.category_id ?? "", row.name ?? ""]),
  );
  const logsTotal = (logs ?? []).reduce((sum, log) => sum + (log.cost ?? 0), 0);

  const identity: [string, string | null | undefined][] = [
    [t("identity.model"), boat.model],
    [t("identity.builder"), boat.builder],
    [t("identity.hull"), boat.hull_number],
    [t("identity.year"), boat.year ? String(boat.year) : null],
    [t("identity.homePort"), boat.home_port],
    [t("identity.flag"), boat.flag],
    [t("identity.sail"), boat.sail_number],
    [t("identity.length"), boat.length_m ? `${String(boat.length_m).replace(".", ",")} m` : null],
  ];

  return (
    <div className="flex flex-col gap-8 print:gap-6 print:text-[11pt]">
      <PageHeader
        title={`${t("title")} · ${boat.name}`}
        subtitle={`${tb(boat.type)} · ${t("subtitle", { date: formatDate(today) })}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button asChild variant="outline">
              <Link href={reportPath(boatId, !showCosts) as Route}>
                {showCosts ? t("hideCosts") : t("showCosts")}
              </Link>
            </Button>
            <ReportPrintButton />
          </div>
        }
      />
      <p className="text-caption text-ink-3 print:hidden">{t("printHint")}</p>

      <Section title={t("sections.identity")}>
        <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {identity
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-border py-1">
                <dt className="text-ink-2">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
        </dl>
      </Section>

      <Section title={t("sections.engines")}>
        {(engines ?? []).length === 0 ? (
          <p className="text-sm text-ink-2">{t("engines.none")}</p>
        ) : (
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>{t("engines.engine")}</th>
                <th className={th}>{t("engines.brand")}</th>
                <th className={cn(th, "text-right")}>{t("engines.hours")}</th>
                <th className={th}>{t("engines.readAt")}</th>
              </tr>
            </thead>
            <tbody>
              {(engines ?? []).map((engine) => {
                const reading = hoursByEngine.get(engine.id);
                return (
                  <tr key={engine.id}>
                    <td className={td}>
                      {engine.label}
                      <span className="text-ink-3"> · {tp(engine.position)}</span>
                    </td>
                    <td className={td}>{[engine.brand, engine.model].filter(Boolean).join(" ")}</td>
                    <td className={cn(td, num)}>
                      {reading?.hours !== null && reading?.hours !== undefined
                        ? formatHours(reading.hours)
                        : t("engines.noReading")}
                    </td>
                    <td className={cn(td, "num")}>
                      {reading?.read_at ? formatDate(reading.read_at) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={t("sections.systems")}>
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>{t("systems.system")}</th>
              <th className={cn(th, "text-right")}>{t("systems.points")}</th>
              <th className={cn(th, "text-right")}>{t("systems.progress")}</th>
              <th className={cn(th, "text-right")}>{t("systems.overdue")}</th>
              <th className={cn(th, "text-right")}>{t("systems.never")}</th>
            </tr>
          </thead>
          <tbody>
            {(progress ?? []).map((row) => {
              const neverDone = (row.total ?? 0) > 0 && row.never_recorded_count === row.total;
              return (
                <tr key={row.category_id ?? row.name ?? ""}>
                  <td className={td}>{row.name}</td>
                  <td className={cn(td, num)}>{row.total ?? 0}</td>
                  <td className={cn(td, num)}>
                    {neverDone ? t("systems.neverDone") : formatPercent(row.progress)}
                  </td>
                  <td className={cn(td, num)}>{row.overdue_count ?? 0}</td>
                  <td className={cn(td, num)}>{row.never_recorded_count ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title={t("sections.due")}>
        {(due ?? []).length === 0 ? (
          <p className="text-sm text-ink-2">{t("due.none")}</p>
        ) : (
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>{t("due.item")}</th>
                <th className={th}>{t("due.system")}</th>
                <th className={th}>{t("due.deadline")}</th>
                <th className={th}>{t("due.state")}</th>
              </tr>
            </thead>
            <tbody>
              {(due ?? []).map((row) => (
                <tr key={row.id ?? row.label ?? ""}>
                  <td className={td}>{row.label}</td>
                  <td className={td}>{categoryNames.get(row.category_id ?? "") ?? ""}</td>
                  <td className={cn(td, "num whitespace-nowrap")}>
                    {[
                      row.due_at ? formatDate(row.due_at) : null,
                      row.due_hours !== null
                        ? t("due.hours", { hours: formatHours(row.due_hours) })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className={td}>
                    {ts((row.status ?? "ok") as "ok" | "soon" | "overdue" | "never")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={t("sections.logs")}>
        {(logs ?? []).length === 0 ? (
          <p className="text-sm text-ink-2">{t("logs.none")}</p>
        ) : (
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>{t("logs.date")}</th>
                <th className={th}>{t("logs.title")}</th>
                <th className={th}>{t("logs.system")}</th>
                <th className={th}>{t("logs.by")}</th>
                {showCosts ? <th className={cn(th, "text-right")}>{t("logs.cost")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((log) => (
                <tr key={log.id ?? ""}>
                  <td className={cn(td, "num whitespace-nowrap")}>
                    {formatDate(log.performed_at)}
                  </td>
                  <td className={td}>{log.title}</td>
                  <td className={td}>{log.category_name}</td>
                  <td className={td}>{log.contact_name ?? t("logs.crew")}</td>
                  {showCosts ? (
                    <td className={cn(td, num)}>
                      {log.cost !== null ? formatCurrency(log.cost) : ""}
                    </td>
                  ) : null}
                </tr>
              ))}
              {showCosts ? (
                <tr>
                  <td className={cn(td, "font-semibold")} colSpan={4}>
                    {t("logs.total")}
                  </td>
                  <td className={cn(td, num, "font-semibold")}>{formatCurrency(logsTotal)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={t("sections.haulOuts")}>
        {(haulOuts ?? []).length === 0 ? (
          <p className="text-sm text-ink-2">{t("haulOuts.none")}</p>
        ) : (
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>{t("haulOuts.out")}</th>
                <th className={th}>{t("haulOuts.in")}</th>
                <th className={th}>{t("haulOuts.yard")}</th>
                <th className={th}>{t("haulOuts.works")}</th>
                {showCosts ? <th className={cn(th, "text-right")}>{t("haulOuts.cost")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {(haulOuts ?? []).map((haulOut) => (
                <tr key={haulOut.id}>
                  <td className={cn(td, "num whitespace-nowrap")}>
                    {formatDate(haulOut.started_at)}
                  </td>
                  <td className={cn(td, "num whitespace-nowrap")}>
                    {haulOut.ended_at ? formatDate(haulOut.ended_at) : t("haulOuts.inProgress")}
                  </td>
                  <td className={td}>{haulOut.yard_name ?? ""}</td>
                  <td className={cn(td, "whitespace-pre-wrap")}>{haulOut.works ?? ""}</td>
                  {showCosts ? (
                    <td className={cn(td, num)}>
                      {haulOut.cost !== null ? formatCurrency(haulOut.cost) : ""}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <p className="border-t border-border pt-4 text-caption text-ink-2">
        {t("footer", { logs: logsCount ?? 0, completions: completionsCount ?? 0 })}
      </p>
    </div>
  );
}
