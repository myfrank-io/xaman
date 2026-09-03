import { getTranslations } from "next-intl/server";

import { formatCurrency, formatDate, formatHours, formatPercent } from "@/lib/format";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils";

const table = "w-full border-collapse text-sm";
const th =
  "border-b border-border py-2 pr-3 text-left text-caption font-semibold text-ink-2 uppercase";
const td = "border-b border-border py-2 pr-3 align-top";
const num = "num text-right whitespace-nowrap";

/**
 * A table wide enough to be a table cannot also fit a 320 px phone. It scrolls inside its own
 * box rather than dragging the whole page sideways, and `print:overflow-visible` keeps the
 * paper version whole — printing is what this screen is for.
 */
function Scroller({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 print:mx-0 print:overflow-visible print:px-0">
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 break-inside-avoid flex-col gap-3">
      <h2 className="text-h2">{title}</h2>
      {children}
    </section>
  );
}

export type ReportBoat = {
  name: string;
  type: Database["public"]["Enums"]["boat_type"];
  model: string | null;
  builder: string | null;
  hull_number: string | null;
  year: number | null;
  home_port: string | null;
  flag: string | null;
  sail_number: string | null;
  length_m: number | null;
};

export type ReportEngine = {
  id: string;
  label: string;
  brand: string | null;
  model: string | null;
  position: Database["public"]["Enums"]["engine_position"];
};

export type ReportReading = {
  engine_id: string | null;
  hours: number | null;
  read_at: string | null;
};

export type ReportProgress = {
  category_id: string | null;
  name: string | null;
  total: number | null;
  progress: number | null;
  overdue_count: number | null;
  never_recorded_count: number | null;
};

export type ReportDue = {
  id: string | null;
  label: string | null;
  category_id: string | null;
  status: string | null;
  due_at: string | null;
  due_hours: number | null;
};

export type ReportLog = {
  id: string | null;
  performed_at: string | null;
  title: string | null;
  category_name: string | null;
  contact_name: string | null;
  cost: number | null;
};

export type ReportHaulOut = {
  id: string;
  started_at: string;
  ended_at: string | null;
  yard_name: string | null;
  works: string | null;
  cost: number | null;
};

/**
 * The printable state report (E9-2b, D-O1) — the document shown to an insurer, a buyer or a
 * surveyor. Tables only, server-rendered, and `@media print` drops the application frame.
 *
 * It sits in a component rather than in the page because the page is six database queries deep:
 * `/dev/ui/report` mounts this with sample rows, which is the only way the screen ever reaches
 * the touch audit.
 */
export async function ReportDocument({
  boat,
  today,
  showCosts,
  engines,
  hours,
  progress,
  due,
  logs,
  haulOuts,
  logsCount,
  completionsCount,
  actions,
}: {
  boat: ReportBoat;
  today: string;
  showCosts: boolean;
  engines: ReportEngine[];
  hours: ReportReading[];
  progress: ReportProgress[];
  due: ReportDue[];
  logs: ReportLog[];
  haulOuts: ReportHaulOut[];
  logsCount: number;
  completionsCount: number;
  /** The « hide costs » link and the print button — they need the boat's own routes. */
  actions?: React.ReactNode;
}) {
  const [t, tb, ts, tp, tc] = await Promise.all([
    getTranslations("report"),
    getTranslations("boatType"),
    getTranslations("checklistState"),
    getTranslations("enginePosition"),
    getTranslations("common"),
  ]);
  const hoursByEngine = new Map(hours.map((row) => [row.engine_id, row]));
  const categoryNames = new Map(progress.map((row) => [row.category_id ?? "", row.name ?? ""]));
  const logsTotal = logs.reduce((sum, log) => sum + (log.cost ?? 0), 0);

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
    <div className="flex min-w-0 flex-col gap-8 print:gap-6 print:text-[11pt]">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-h1 break-words">
          {t("title")} · {boat.name}
        </h1>
        <p className="text-body text-ink-2">
          {tb(boat.type)} · {t("subtitle", { date: formatDate(today) })}
        </p>
        {actions ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">{actions}</div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 print:hidden">
        <p className="text-caption text-ink-3">{t("printHint")}</p>
        <p className="text-caption text-ink-3 sm:hidden">{tc("scrollTable")}</p>
      </div>

      <Section title={t("sections.identity")}>
        <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {identity
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-border py-1">
                <dt className="text-ink-2">{label}</dt>
                <dd className="min-w-0 text-right font-medium break-words">{value}</dd>
              </div>
            ))}
        </dl>
      </Section>

      <Section title={t("sections.engines")}>
        {engines.length === 0 ? (
          <p className="text-sm text-ink-2">{t("engines.none")}</p>
        ) : (
          <Scroller>
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
                {engines.map((engine) => {
                  const reading = hoursByEngine.get(engine.id);
                  return (
                    <tr key={engine.id}>
                      <td className={td}>
                        {engine.label}
                        <span className="text-ink-3"> · {tp(engine.position)}</span>
                      </td>
                      <td className={td}>
                        {[engine.brand, engine.model].filter(Boolean).join(" ")}
                      </td>
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
          </Scroller>
        )}
      </Section>

      <Section title={t("sections.systems")}>
        <Scroller>
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
              {progress.map((row) => {
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
        </Scroller>
      </Section>

      <Section title={t("sections.due")}>
        {due.length === 0 ? (
          <p className="text-sm text-ink-2">{t("due.none")}</p>
        ) : (
          <Scroller>
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
                {due.map((row) => (
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
          </Scroller>
        )}
      </Section>

      <Section title={t("sections.logs")}>
        {logs.length === 0 ? (
          <p className="text-sm text-ink-2">{t("logs.none")}</p>
        ) : (
          <Scroller>
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
                {logs.map((log) => (
                  <tr key={log.id ?? ""}>
                    <td className={cn(td, "num whitespace-nowrap")}>
                      {log.performed_at ? formatDate(log.performed_at) : ""}
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
          </Scroller>
        )}
      </Section>

      <Section title={t("sections.haulOuts")}>
        {haulOuts.length === 0 ? (
          <p className="text-sm text-ink-2">{t("haulOuts.none")}</p>
        ) : (
          <Scroller>
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>{t("haulOuts.out")}</th>
                  <th className={th}>{t("haulOuts.in")}</th>
                  <th className={th}>{t("haulOuts.yard")}</th>
                  <th className={th}>{t("haulOuts.works")}</th>
                  {showCosts ? (
                    <th className={cn(th, "text-right")}>{t("haulOuts.cost")}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {haulOuts.map((haulOut) => (
                  <tr key={haulOut.id}>
                    <td className={cn(td, "num whitespace-nowrap")}>
                      {formatDate(haulOut.started_at)}
                    </td>
                    <td className={cn(td, "num whitespace-nowrap")}>
                      {haulOut.ended_at ? formatDate(haulOut.ended_at) : t("haulOuts.inProgress")}
                    </td>
                    <td className={td}>{haulOut.yard_name ?? ""}</td>
                    <td className={cn(td, "min-w-40 whitespace-pre-wrap")}>
                      {haulOut.works ?? ""}
                    </td>
                    {showCosts ? (
                      <td className={cn(td, num)}>
                        {haulOut.cost !== null ? formatCurrency(haulOut.cost) : ""}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        )}
      </Section>

      <p className="border-t border-border pt-4 text-caption text-ink-2">
        {t("footer", { logs: logsCount, completions: completionsCount })}
      </p>
    </div>
  );
}
