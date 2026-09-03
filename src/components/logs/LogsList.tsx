"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpIcon, PaperclipIcon } from "lucide-react";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { StatusBadge } from "@/components/common/StatusBadge";
import { shortEngineLabel, type LogRow } from "@/components/logs/rows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { logPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

const HALO_MS = 2000;
/** Below this scroll position the list has not moved: a new row can be inserted safely. */
const SCROLLED_PX = 120;

/**
 * The journal rows (E3-2) plus the two live behaviours of §5.7: a row changed by another
 * device gets a 2 s halo, and a row inserted at the top while the list is scrolled is held
 * behind a « 1 nouvelle intervention · Afficher » pill instead of shifting the content under
 * the finger.
 */
export function LogsList({ boatId, rows }: { boatId: string; rows: LogRow[] }) {
  const t = useTranslations("logs");
  const tc = useTranslations("common");
  const [held, setHeld] = useState<string[]>([]);
  const [halo, setHalo] = useState<string[]>([]);
  const seen = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const current = new Map(rows.map((row) => [row.id, row.updatedAt]));
    const previous = seen.current;
    seen.current = current;
    if (previous === null) return; // first render: nothing is « new »

    const added = rows.filter((row) => !previous.has(row.id)).map((row) => row.id);
    const changed = rows
      .filter((row) => previous.has(row.id) && previous.get(row.id) !== row.updatedAt)
      .map((row) => row.id);

    if (changed.length > 0) setHalo(changed);
    if (added.length > 0 && window.scrollY > SCROLLED_PX) {
      setHeld((current) => [...new Set([...current, ...added])]);
    }
  }, [rows]);

  useEffect(() => {
    if (halo.length === 0) return;
    const timer = setTimeout(() => setHalo([]), HALO_MS);
    return () => clearTimeout(timer);
  }, [halo]);

  const visible = rows.filter((row) => !held.includes(row.id));

  return (
    <div className="flex flex-col">
      {held.length > 0 ? (
        <div className="sticky top-0 z-10 flex justify-center py-2">
          <Button
            size="sm"
            onClick={() => {
              setHeld([]);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <ArrowUpIcon />
            {`${t("newRows", { count: held.length })} · ${tc("show")}`}
          </Button>
        </div>
      ) : null}
      {visible.map((row) => (
        <ListRow
          key={row.id}
          size="lg"
          categoryColor={row.categoryColor ?? undefined}
          className={cn(
            "transition-colors duration-500",
            halo.includes(row.id) && "bg-status-planned-tint",
          )}
          lead={
            <span className="w-24 shrink-0 num text-caption text-ink-2">
              {formatDate(row.performedAt)}
            </span>
          }
          title={row.title}
          meta={
            <>
              {row.categoryColor ? <CategoryDot color={row.categoryColor} /> : null}
              <span className="truncate">{row.categoryName ?? ""}</span>
              <StatusBadge status={row.status} size="sm" />
              <span className="truncate">{row.contactName ?? t("byCrew")}</span>
              {row.attachmentsCount > 0 ? (
                /* No colour of its own (rule 12): the paperclip says « il y a la facture ». */
                <span className="flex shrink-0 items-center gap-0.5 text-ink-2">
                  <PaperclipIcon className="size-3.5" aria-hidden />
                  <span className="num" aria-hidden>
                    {row.attachmentsCount}
                  </span>
                  <span className="sr-only">
                    {t("attachments", { count: row.attachmentsCount })}
                  </span>
                </span>
              ) : null}
              {row.needsReview ? (
                <Badge
                  size="sm"
                  variant="outline"
                  className="border-state-soon-border bg-state-soon-tint text-state-soon-fg"
                >
                  {t("review.badge")}
                </Badge>
              ) : null}
            </>
          }
          trailing={
            <span className="flex flex-col items-end gap-0.5">
              {row.engineHours.map((entry) => (
                <span
                  key={entry.engineId}
                  className="num text-caption whitespace-nowrap text-ink-2"
                >
                  {`${shortEngineLabel(entry.label)} ${formatHours(entry.hours)}`}
                </span>
              ))}
              {row.cost !== null ? (
                <span className="num text-caption font-medium whitespace-nowrap text-foreground">
                  {formatCurrency(row.cost)}
                </span>
              ) : null}
            </span>
          }
          href={logPath(boatId, row.id)}
        />
      ))}
    </div>
  );
}
