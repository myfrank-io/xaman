"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlertIcon } from "lucide-react";

import { CategoryBar } from "@/components/common/CategoryBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/format";
import { groupBatch, tallyBatch, type BatchGroup, type PlannedLine } from "@/lib/inbox/batch-plan";
import type { InboxDocumentFamily } from "@/lib/schemas/inbox";

/**
 * « Ce que j'ai lu » (E17-2, D113).
 *
 * A delivery note or a survey report proposes a boat's worth of lines at once. The screen's whole
 * job is to let someone say yes to them **without reading a wall**: grouped by the boat's own
 * systems, each line saying in one glance what it would do, and every disagreement with the carnet
 * shown *beside* what the carnet holds — unchecked, with the document's own date next to it,
 * because a document can be read perfectly and still be a year out of date.
 *
 * Nothing here writes. The parent hands it `onSubmit`, which is what turns the ticked lines into
 * carnet rows; the screen only ever decides what is ticked.
 */
export type InboxBatchCategory = { externalRef: string | null; name: string; color: string };

export type InboxBatchReviewProps = {
  planned: PlannedLine[];
  categories: readonly InboxBatchCategory[];
  documentFamily: InboxDocumentFamily;
  /** The document's own date, printed once in the header and again on any line that disagrees. */
  documentDate: string | null;
  /** Family labels by `external_ref`, so a line can say what sort of thing it is. */
  familyLabels?: Record<string, string>;
  busy?: boolean;
  onSubmit: (indexes: number[]) => void;
};

/** Every line carries its index in the original batch: that is what the write path is given. */
type IndexedLine = PlannedLine & { index: number };

/**
 * The headings that are not one of the boat's systems. Spelled out rather than interpolated, so
 * next-intl checks at compile time that each one exists — a heading that silently prints its own
 * key is the kind of thing nobody notices until a screenshot.
 */
const SPECIAL_HEADINGS: Record<
  string,
  "groups.providers" | "groups.identity" | "groups.deadlines" | "groups.unfiled"
> = {
  providers: "groups.providers",
  identity: "groups.identity",
  deadlines: "groups.deadlines",
  unfiled: "groups.unfiled",
};

export function InboxBatchReview({
  planned,
  categories,
  documentFamily,
  documentDate,
  familyLabels = {},
  busy = false,
  onSubmit,
}: InboxBatchReviewProps) {
  const t = useTranslations("inbox.batch");

  const indexed = useMemo<IndexedLine[]>(
    () => planned.map((row, index) => ({ ...row, index })),
    [planned],
  );
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(indexed.filter((row) => row.checked).map((row) => row.index)),
  );

  const groups = useMemo(() => groupBatch(indexed, categories), [indexed, categories]);
  const tally = useMemo(() => tallyBatch(planned), [planned]);

  function toggle(index: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  /**
   * « Tout cocher » deliberately leaves the contradictions out. Ticking every line at once is a
   * convenience for the ninety that agree; a disagreement with the carnet stays a decision
   * someone makes on purpose (D113), and a « select all » that swept them in would quietly undo
   * the whole point of showing them.
   */
  const selectable = indexed
    .filter((row) => row.outcome.kind === "create" || row.outcome.kind === "fill")
    .map((row) => row.index);
  const allSelected = selectable.length > 0 && selectable.every((index) => checked.has(index));

  if (planned.length === 0) {
    return <p className="px-4 py-6 text-body text-ink-2">{t("empty")}</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 px-4">
        <h3 className="text-title font-medium text-foreground">{t("title")}</h3>
        <p className="text-caption text-ink-2">
          {documentDate
            ? t("subtitle", {
                family: t(`family.${documentFamily}`),
                date: formatDate(documentDate),
              })
            : t("subtitleNoDate", { family: t(`family.${documentFamily}`) })}
        </p>
        <p className="text-caption text-ink-2">{t("plan", tally)}</p>
      </header>

      <div className="flex flex-wrap gap-2 px-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setChecked(allSelected ? new Set() : new Set([...checked, ...selectable]))}
        >
          {allSelected ? t("selectNone") : t("selectAll")}
        </Button>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <BatchGroupSection
            key={group.key}
            group={group}
            checked={checked}
            onToggle={toggle}
            documentDate={documentDate}
            familyLabels={familyLabels}
          />
        ))}
      </div>

      <div className="px-4 pb-2">
        <Button
          type="button"
          className="w-full"
          disabled={busy || checked.size === 0}
          onClick={() => onSubmit([...checked].sort((a, b) => a - b))}
        >
          {checked.size === 0
            ? t("nothingChecked")
            : checked.size === selectable.length && selectable.length > 0
              ? t("addAll")
              : t("addSelected", { count: checked.size })}
        </Button>
      </div>
    </section>
  );
}

function BatchGroupSection({
  group,
  checked,
  onToggle,
  documentDate,
  familyLabels,
}: {
  group: BatchGroup<IndexedLine>;
  checked: Set<number>;
  onToggle: (index: number) => void;
  documentDate: string | null;
  familyLabels: Record<string, string>;
}) {
  const t = useTranslations("inbox.batch");
  const heading = group.category
    ? group.category.name
    : t(SPECIAL_HEADINGS[group.key] ?? "groups.unfiled");

  return (
    <div className="flex flex-col">
      <h4 className="flex items-center gap-2 px-4 pb-1 text-caption font-medium text-ink-2">
        {group.category ? <CategoryBar color={group.category.color} className="h-4" /> : null}
        {heading}
      </h4>
      <ul className="flex flex-col">
        {group.lines.map((row) => (
          <BatchLineRow
            key={row.index}
            row={row}
            checked={checked.has(row.index)}
            onToggle={() => onToggle(row.index)}
            documentDate={documentDate}
            familyLabels={familyLabels}
          />
        ))}
      </ul>
    </div>
  );
}

function BatchLineRow({
  row,
  checked,
  onToggle,
  documentDate,
  familyLabels,
}: {
  row: IndexedLine;
  checked: boolean;
  onToggle: () => void;
  documentDate: string | null;
  familyLabels: Record<string, string>;
}) {
  const t = useTranslations("inbox.batch");
  const { line, outcome } = row;
  const id = `batch-line-${row.index}`;
  const contradicts = outcome.kind === "contradiction";

  /** What the line is, under its label: family, quantity, reference, validity. */
  const details = [
    line.kindRef ? familyLabels[line.kindRef] : null,
    line.quantity > 1 ? t("quantity", { count: line.quantity }) : null,
    // What an identity line proposes, not which field it is — the label already says that.
    line.type === "identity" ? line.identityValue : null,
    line.validUntil ? t("validUntil", { date: formatDate(line.validUntil) }) : null,
    line.ref ? t("ref", { ref: line.ref }) : null,
  ].filter(Boolean);

  return (
    <li className="border-b border-border last:border-b-0">
      {/* The whole row is the label of its checkbox: a 44 px target on a list nobody aims at. */}
      <label
        htmlFor={id}
        className="flex min-h-16 w-full cursor-pointer items-start gap-3 tap-feedback px-4 py-3 text-left"
      >
        <Checkbox id={id} checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-body font-medium text-foreground">{line.label}</span>
            {line.type === "equipment" && line.status !== "unknown" ? (
              <span className="text-caption text-ink-2">{t(`status.${line.status}`)}</span>
            ) : null}
          </span>

          {details.length > 0 ? (
            <span className="text-caption text-ink-2">{details.join(" · ")}</span>
          ) : null}

          {/* D113, the whole reason this screen exists: what the carnet says, then what the paper
              says, side by side — and the paper's date right under it. */}
          {contradicts ? (
            <span className="mt-1 flex flex-col gap-1 rounded-md bg-surface-2 p-2">
              {outcome.divergences.map((divergence) => (
                <span key={divergence.field} className="flex items-start gap-1.5 text-caption">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden />
                  <span className="text-foreground">
                    <span className="text-ink-2">{t(`field.${divergence.field}`)} · </span>
                    {t("divergence", {
                      carnet: divergence.carnet,
                      document: divergence.document,
                    })}
                  </span>
                </span>
              ))}
              <span className="text-caption text-ink-2">
                {t("divergenceHelp", {
                  date: formatDate(line.documentDate ?? documentDate ?? ""),
                })}
              </span>
            </span>
          ) : null}
        </span>

        <Badge variant={contradicts ? "warning" : "secondary"} className="mt-0.5 shrink-0">
          {outcome.kind === "fill"
            ? t("outcome.fill", {
                fields: outcome.fields.map((field) => t(`fieldShort.${field}`)).join(", "),
              })
            : t(`outcome.${outcome.kind}`)}
        </Badge>
      </label>
    </li>
  );
}
