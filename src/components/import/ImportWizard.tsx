"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, FileSpreadsheetIcon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { importRows } from "@/lib/actions/import";
import {
  descriptorOf,
  IMPORT_MAX_ROWS,
  type ImportEntity,
  type ImportReport,
} from "@/lib/import/entities";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import {
  applyMapping,
  guessMapping,
  missingRequired,
  type ColumnMapping,
} from "@/lib/import/mapping";
import { parseTable, type ParsedTable } from "@/lib/import/parse";

const PREVIEW_ROWS = 8;
const NO_COLUMN = "";

/**
 * Import screen (E12-1, E12-2): drop a file or paste the cells, check the column mapping,
 * look at the first lines, import. Nothing is written before the last tap, and the mapping is
 * always visible — an import that guesses silently is an import nobody trusts.
 */
export function ImportWizard({
  boatId,
  entity,
  backHref,
  backLabel,
}: {
  boatId: string;
  entity: ImportEntity;
  backHref: string;
  backLabel: string;
}) {
  const t = useTranslations("import");
  const te = useTranslations(`import.entities.${entity}`);
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [raw, setRaw] = useState("");
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [report, setReport] = useState<ImportReport | null>(null);

  const descriptor = descriptorOf(entity);
  const fields = descriptor.fields;

  function load(text: string) {
    setRaw(text);
    setReport(null);
    const parsed = parseTable(text);
    setTable(parsed.headers.length > 0 ? parsed : null);
    setMapping(parsed.headers.length > 0 ? guessMapping(parsed.headers, fields) : {});
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      toast.error(t("errors.xlsxNotYet"));
      return;
    }
    load(await file.text());
  }

  const missing = useMemo(() => missingRequired(fields, mapping), [fields, mapping]);
  const rows = table?.rows ?? [];
  const tooMany = rows.length > IMPORT_MAX_ROWS;

  function run() {
    if (!table) return;
    const mapped = rows.map((row) => applyMapping(row, fields, mapping));
    startTransition(async () => {
      const result = await importRows({ boatId, entity, rows: mapped });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setReport(result.data);
      const { created, updated } = result.data;
      if (created + updated > 0) toast.success(t("done", { created, updated }));
      router.refresh();
    });
  }

  function downloadRejects() {
    if (!report || report.rejected.length === 0) return;
    const header = ["Ligne", "Motif", ...fields.map((field) => field.label)];
    const lines = report.rejected.map((row) => [
      String(row.line),
      t(row.reason.replace(/^import\./, "") as "errors.noName"),
      ...fields.map((field) => row.values[field.key] ?? ""),
    ]);
    const csv = [header, ...lines]
      .map((cells) => cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `xaman-import-refuses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <h2 className="text-h2">{t("source.title")}</h2>
        <p className="text-caption text-ink-2">{te("help")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="sr-only"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
            <UploadIcon />
            {t("source.file")}
          </Button>
          <span className="text-caption text-ink-3">{t("source.or")}</span>
        </div>
        <Label htmlFor="import-paste">{t("source.paste")}</Label>
        <Textarea
          id="import-paste"
          rows={5}
          value={raw}
          spellCheck={false}
          placeholder={te("placeholder")}
          onChange={(event) => load(event.target.value)}
        />
      </section>

      {table === null ? (
        <EmptyState
          icon={<FileSpreadsheetIcon aria-hidden />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-h2">{t("mapping.title")}</h2>
            <p className="text-caption text-ink-2">{t("mapping.help")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key} className="grid gap-2">
                  <Label htmlFor={`map-${field.key}`}>
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <NativeSelect
                    id={`map-${field.key}`}
                    value={
                      mapping[field.key] === null || mapping[field.key] === undefined
                        ? NO_COLUMN
                        : String(mapping[field.key])
                    }
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [field.key]:
                          event.target.value === NO_COLUMN ? null : Number(event.target.value),
                      }))
                    }
                  >
                    <option value={NO_COLUMN}>{t("mapping.none")}</option>
                    {table.headers.map((header, index) => (
                      <option key={`${header}-${index}`} value={index}>
                        {header || t("mapping.column", { index: index + 1 })}
                      </option>
                    ))}
                  </NativeSelect>
                  {field.help ? <p className="text-caption text-ink-3">{field.help}</p> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-h2">{t("preview.title", { count: rows.length })}</h2>
            <div className="relative overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full border-collapse text-caption">
                <thead>
                  <tr className="border-b border-border bg-n-50 text-left">
                    {fields.map((field) => (
                      <th key={field.key} className="px-3 py-2 font-medium whitespace-nowrap">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_ROWS).map((row, index) => {
                    const values = applyMapping(row, fields, mapping);
                    return (
                      <tr key={index} className="border-b border-border last:border-0">
                        {fields.map((field) => (
                          <td key={field.key} className="px-3 py-2 whitespace-nowrap text-ink-2">
                            {values[field.key] || "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length > PREVIEW_ROWS ? (
              <p className="text-caption text-ink-3">
                {t("preview.more", { count: rows.length - PREVIEW_ROWS })}
              </p>
            ) : null}
          </section>

          {missing.length > 0 ? (
            <Alert>
              <AlertDescription>
                {t("mapping.missing", { fields: missing.join(", ") })}
              </AlertDescription>
            </Alert>
          ) : null}
          {tooMany ? (
            <Alert>
              <AlertDescription>{t("errors.tooMany", { max: IMPORT_MAX_ROWS })}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="outline">
              <Link href={backHref as Route}>{backLabel}</Link>
            </Button>
            <Button
              type="button"
              size="xl"
              onClick={run}
              disabled={pending || missing.length > 0 || rows.length === 0 || tooMany}
              aria-busy={pending}
            >
              {pending ? <Spinner className="size-4" /> : <CheckCircle2Icon />}
              {t("run", { count: rows.length })}
            </Button>
          </div>
        </>
      )}

      {report ? (
        <section className="flex flex-col gap-3 rounded-xl border border-state-ok-border bg-state-ok-tint p-4 sm:p-5">
          <h2 className="text-h2">{t("report.title")}</h2>
          <p className="text-body">
            {t("report.summary", {
              created: report.created,
              updated: report.updated,
              rejected: report.rejected.length,
            })}
          </p>
          {report.rejected.length > 0 ? (
            <>
              <ul className="flex flex-col gap-1 text-caption text-ink-2">
                {report.rejected.slice(0, 5).map((row) => (
                  <li key={row.line}>
                    {t("report.line", { line: row.line })} ·{" "}
                    {t(row.reason.replace(/^import\./, "") as "errors.noName")}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={downloadRejects}>
                  {t("report.download")}
                </Button>
                <Button asChild>
                  <Link href={backHref as Route}>{backLabel}</Link>
                </Button>
              </div>
            </>
          ) : (
            <Button asChild className="self-start">
              <Link href={backHref as Route}>{backLabel}</Link>
            </Button>
          )}
        </section>
      ) : null}
    </div>
  );
}
