"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/EmptyState";
import { specialtyOptions } from "@/components/contacts/specialties";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { importRows } from "@/lib/actions/import";
import {
  cellText,
  createMatcher,
  descriptorOf,
  IMPORT_MAX_ROWS,
  IMPORT_NAME_MAX,
  rejectionReason,
  rememberRow,
  type ImportCatalog,
  type ImportEntity,
  type ImportReport,
} from "@/lib/import/entities";
import { PickPhoneContactsButton } from "@/components/import/PickPhoneContactsButton";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import {
  applyDefaults,
  applyMapping,
  guessMapping,
  missingRequired,
  type ColumnMapping,
  type FieldDefaults,
} from "@/lib/import/mapping";
import { parseTable, type ParsedTable } from "@/lib/import/parse";
import { templateCsv, templateFileName } from "@/lib/import/template";
import { parseContactCards, isContactCardFile } from "@/lib/import/vcard";
import { isLegacyExcelFile, isSpreadsheetFile, readWorkbook, type Sheet } from "@/lib/import/xlsx";
import { cn } from "@/lib/utils";

/** « Autre » chip: never the empty string, which Radix reads as « nothing selected ». */
const OTHER_TRADE = "__other__";

const PREVIEW_ROWS = 8;
const NO_FIELD = "";
/** Beyond four sheets the chips become a wall; the native picker handles a long list. */
const SHEET_CHIPS_MAX = 4;
/** Enough lines to find a real value in a column that starts with a few blanks. */
const SAMPLE_SCAN = 40;
const SAMPLES_PER_COLUMN = 3;

const FILE_ACCEPT = ".csv,.tsv,.txt,.xlsx,.xlsm,.vcf,.vcard,text/csv,text/plain";

/** `ZipError` carries a short code as its message; each one gets its own French sentence. */
const READ_ERRORS: Record<string, string> = {
  not_a_zip: "errors.notAZip",
  zip64_unsupported: "errors.zip64",
  truncated: "errors.truncated",
  unsupported_compression: "errors.compression",
  no_decompressor: "errors.noDecompressor",
  not_a_workbook: "errors.notAWorkbook",
  no_sheet: "errors.noSheet",
  too_large: "errors.tooLarge",
};

type Outcome = { kind: "created" | "updated" | "rejected"; reason: string | null };

/**
 * Import screen (E12-1 → E12-7), in three steps that collapse as they are satisfied:
 *
 * 1. the source — a file (`.csv`, `.tsv`, `.xlsx`, `.xlsm`, `.vcf`) or cells pasted from
 *    Excel — folded to one line as soon as a table is read, so the raw text never sits next
 *    to the result;
 * 2. the mapping, one card per column **of the file**: its header as written, the first real
 *    values it holds, and the Xaman field it feeds. Going column by column means recognising
 *    one's own spreadsheet instead of learning our vocabulary; a guess is marked as a guess,
 *    and a column left aside says so rather than disappearing;
 * 3. the preview of the rows that will be written — mapping and default values already
 *    applied — with the count of creations, updates and refusals announced *before* the write.
 *
 * Nothing is written before the last tap.
 */
export function ImportWizard({
  boatId,
  entity,
  backHref,
  backLabel,
  existingKeys = [],
  catalog,
  initialText,
}: {
  boatId: string;
  entity: ImportEntity;
  backHref: string;
  backLabel: string;
  /** Natural keys already on the boat: what tells a creation from an update before the write. */
  existingKeys?: string[];
  /**
   * The checklist points and the engines a line may name (E12-4), so the preview refuses
   * exactly what the write will refuse.
   */
  catalog?: ImportCatalog;
  /** Preloaded cells, for the design gallery. */
  initialText?: string;
}) {
  const t = useTranslations("import");
  const te = useTranslations(`import.entities.${entity}`);
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const descriptor = descriptorOf(entity);
  const fields = descriptor.fields;

  const seed = useMemo(() => {
    const parsed = initialText ? parseTable(initialText) : null;
    return parsed && parsed.headers.length > 0 ? parsed : null;
  }, [initialText]);

  const [raw, setRaw] = useState(initialText ?? "");
  const [origin, setOrigin] = useState<string | null>(null);
  const [table, setTable] = useState<ParsedTable | null>(seed);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>(() =>
    seed ? guessMapping(seed.headers, fields) : {},
  );
  const [defaults, setDefaults] = useState<FieldDefaults>({});
  /** Columns whose field the person chose: the others still show their guess as a guess. */
  const [chosen, setChosen] = useState<ReadonlySet<number>>(new Set<number>());
  const [sourceOpen, setSourceOpen] = useState(seed === null);
  const [report, setReport] = useState<ImportReport | null>(null);

  function loadTable(parsed: ParsedTable, from: string | null, collapse: boolean) {
    setReport(null);
    setChosen(new Set<number>());
    setOrigin(from);
    if (parsed.headers.length === 0) {
      setTable(null);
      setMapping({});
      setSourceOpen(true);
      return;
    }
    setTable(parsed);
    setMapping(guessMapping(parsed.headers, fields));
    if (collapse) setSourceOpen(false);
  }

  function loadText(text: string, from: string | null, collapse: boolean) {
    setRaw(from === null ? text : "");
    loadTable(parseTable(text), from, collapse);
  }

  function readError(error: unknown): string {
    const code = error instanceof Error ? error.message : "";
    return t((READ_ERRORS[code] ?? "errors.unreadable") as "errors.unreadable");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      // The binary format of Excel 97 is not a ZIP and cannot be opened here.
      if (isLegacyExcelFile(file.name)) {
        toast.error(t("errors.legacyExcel"));
        return;
      }
      if (isContactCardFile(file.name)) {
        setSheets([]);
        const parsed = parseContactCards(await file.text());
        if (parsed.rows.length === 0) toast.error(t("errors.noTable"));
        loadTable(parsed, file.name, true);
        return;
      }
      if (isSpreadsheetFile(file.name)) {
        const found = await readWorkbook(await file.arrayBuffer());
        const first = found[0];
        if (!first) {
          toast.error(t("errors.noSheet"));
          return;
        }
        setSheets(found);
        setSheetIndex(0);
        setRaw("");
        loadTable(first.table, file.name, true);
        return;
      }
      setSheets([]);
      loadText(await file.text(), file.name, true);
    } catch (error) {
      toast.error(readError(error));
    } finally {
      // Choosing the same file twice must fire `change` again.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function chooseSheet(index: number) {
    const sheet = sheets[index];
    if (!sheet) return;
    setSheetIndex(index);
    loadTable(sheet.table, origin, true);
  }

  function downloadTemplate() {
    download(templateCsv(descriptor), templateFileName(descriptor));
  }

  const rows = useMemo(() => table?.rows ?? [], [table]);

  /** One entry per column of the file: its header, and the first real values it holds. */
  const columns = useMemo(
    () =>
      (table?.headers ?? []).map((header, index) => ({
        index,
        header,
        samples: rows
          .slice(0, SAMPLE_SCAN)
          .map((row) => (row[index] ?? "").trim())
          .filter((value) => value !== "")
          .slice(0, SAMPLES_PER_COLUMN),
      })),
    [table, rows],
  );

  const fieldByColumn = useMemo(() => {
    const found = new Map<number, string>();
    for (const field of fields) {
      const index = mapping[field.key];
      if (index !== null && index !== undefined) found.set(index, field.key);
    }
    return found;
  }, [fields, mapping]);

  /** A field feeds one column at most: putting it on another one frees the first. */
  function assign(column: number, fieldKey: string) {
    setMapping((current) => {
      const next: ColumnMapping = { ...current };
      for (const key of Object.keys(next)) if (next[key] === column) next[key] = null;
      if (fieldKey !== NO_FIELD) next[fieldKey] = column;
      return next;
    });
    setChosen((current) => new Set(current).add(column));
    setReport(null);
  }

  // One page can hold several wizards (the /dev/ui gallery does): the id carries the entity so
  // the label points at its own field rather than at the first one on the page.
  const pasteId = `import-paste-${entity}`;
  const defaultFields = useMemo(() => fields.filter((field) => field.allowDefault), [fields]);
  const tc = useTranslations("contacts.specialties");
  const tCommon = useTranslations("common");
  /**
   * A trade is chosen, not spelled (D44): the seven built-ins plus every trade this boat
   * already uses, and « Autre » to name a new one — the same list the contact form offers,
   * from the same reader, so the two screens can never disagree.
   */
  const specialtyChips = useMemo(
    () => specialtyOptions((key) => tc(key), catalog?.specialties ?? []),
    [tc, catalog?.specialties],
  );
  const chipsFor = (key: string): string[] => (key === "specialty" ? specialtyChips : []);
  const missing = useMemo(
    () => missingRequired(fields, mapping, defaults),
    [fields, mapping, defaults],
  );
  const unfed = useMemo(
    () =>
      fields.filter(
        (field) =>
          (mapping[field.key] === null || mapping[field.key] === undefined) &&
          (defaults[field.key] ?? "").trim() === "",
      ),
    [fields, mapping, defaults],
  );

  /** Exactly what will be written: the mapping applied, then the values chosen for the file. */
  const mappedRows = useMemo(
    () => rows.map((row) => applyDefaults(applyMapping(row, fields, mapping), fields, defaults)),
    [rows, fields, mapping, defaults],
  );

  /**
   * What each line will do, decided with the same rules as the write: a name already on the
   * boat — or already met earlier in the file — is an update, not a duplicate.
   */
  const outcomes = useMemo<Outcome[]>(() => {
    const seen = new Set(existingKeys);
    // Built here, not once for the screen: the matcher takes in the lines already read, so a
    // recomputation must start again from what the boat carries and nothing else.
    const match = createMatcher(catalog);
    return mappedRows.map((values) => {
      const reason = rejectionReason(entity, values, match);
      if (reason) return { kind: "rejected", reason };
      rememberRow(entity, values, match);
      const key = descriptor.naturalKey(
        { ...values, name: cellText(values.name, IMPORT_NAME_MAX) ?? "" },
        match,
      );
      if (seen.has(key)) return { kind: "updated", reason: null };
      seen.add(key);
      return { kind: "created", reason: null };
    });
  }, [mappedRows, entity, descriptor, existingKeys, catalog]);

  const plan = useMemo(
    () => ({
      created: outcomes.filter((outcome) => outcome.kind === "created").length,
      updated: outcomes.filter((outcome) => outcome.kind === "updated").length,
      rejected: outcomes.filter((outcome) => outcome.kind === "rejected").length,
    }),
    [outcomes],
  );

  /** Columns of the preview: only what is actually fed, the required fields first. */
  const previewFields = useMemo(() => {
    const fed = fields.filter((field) => !unfed.includes(field));
    const shown = fed.length > 0 ? fed : fields.filter((field) => field.required);
    return [
      ...shown.filter((field) => field.required),
      ...shown.filter((field) => !field.required),
    ];
  }, [fields, unfed]);

  const tooMany = rows.length > IMPORT_MAX_ROWS;

  function run() {
    if (!table) return;
    startTransition(async () => {
      const result = await importRows({ boatId, entity, rows: mappedRows });
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
    download(`﻿${csv}`, "xaman-import-refuses.csv");
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2">{t("steps.source")}</h2>
          {table && !sourceOpen ? (
            <Button type="button" variant="outline" onClick={() => setSourceOpen(true)}>
              <RefreshCwIcon />
              {t("source.change")}
            </Button>
          ) : null}
        </div>

        {table && !sourceOpen ? (
          <p className="flex items-start gap-2 text-body text-ink-2">
            <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-state-ok-fg" />
            <span className="min-w-0 break-words">
              {t("source.summary", {
                rows: rows.length,
                columns: table.headers.length,
                origin: origin ?? t("source.pasted"),
              })}
            </span>
          </p>
        ) : (
          <>
            <p className="text-caption text-ink-2">{te("help")}</p>
            <input
              ref={fileInput}
              type="file"
              accept={FILE_ACCEPT}
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center gap-3">
              {/* The label names every accepted format, so on a phone it wraps rather than
                  pushing the page sideways. */}
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-11 w-full py-2 whitespace-normal sm:w-auto"
                onClick={() => fileInput.current?.click()}
              >
                <UploadIcon />
                {t("source.file")}
              </Button>
              {/* Absent unless the browser can open the address book (Chromium on Android
                  today; iOS keeps it behind a flag). Picking cards produces exactly the table
                  a `.vcf` produces, so it goes through the same mapping and preview. */}
              {entity === "contacts" ? (
                <PickPhoneContactsButton
                  onPicked={(picked, origin) => loadTable(picked, origin, true)}
                />
              ) : null}
              <Button type="button" variant="outline" onClick={downloadTemplate}>
                <DownloadIcon />
                {t("source.template")}
              </Button>
            </div>
            <div className="flex flex-col gap-1 text-caption text-ink-3">
              <p>{t("source.formats")}</p>
              <p>{t("source.templateHelp")}</p>
            </div>
            <span className="text-caption text-ink-3">{t("source.or")}</span>
            <Label htmlFor={pasteId}>{t("source.paste")}</Label>
            <Textarea
              id={pasteId}
              rows={4}
              value={raw}
              spellCheck={false}
              placeholder={te("placeholder")}
              onChange={(event) => loadText(event.target.value, null, false)}
              onBlur={() => {
                if (table) setSourceOpen(false);
              }}
            />
            {table ? (
              <Button type="button" className="self-start" onClick={() => setSourceOpen(false)}>
                {t("source.keep")}
              </Button>
            ) : null}
          </>
        )}

        {sheets.length > 1 ? (
          <div className="flex flex-col gap-2">
            <span className="text-label" id="import-sheet-label">
              {t("source.sheet")}
            </span>
            {sheets.length > SHEET_CHIPS_MAX ? (
              <NativeSelect
                aria-labelledby="import-sheet-label"
                value={String(sheetIndex)}
                onChange={(event) => chooseSheet(Number(event.target.value))}
              >
                {sheets.map((sheet, index) => (
                  <option key={`${sheet.name}-${index}`} value={index}>
                    {sheet.name}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <ToggleGroup
                type="single"
                aria-labelledby="import-sheet-label"
                value={String(sheetIndex)}
                onValueChange={(value) => {
                  if (value !== "") chooseSheet(Number(value));
                }}
              >
                {sheets.map((sheet, index) => (
                  <ToggleGroupItem key={`${sheet.name}-${index}`} value={String(index)}>
                    {sheet.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </div>
        ) : null}
      </section>

      {table === null ? (
        <EmptyState
          icon={<FileSpreadsheetIcon aria-hidden />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : sourceOpen ? null : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-h2">{t("steps.mapping")}</h2>
            <p className="text-caption text-ink-2">{t("mapping.help")}</p>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {columns.map((column) => {
                const fieldKey = fieldByColumn.get(column.index) ?? NO_FIELD;
                const field = fields.find((candidate) => candidate.key === fieldKey);
                const guessed = fieldKey !== NO_FIELD && !chosen.has(column.index);
                return (
                  <div
                    key={column.index}
                    className={cn(
                      "flex min-w-0 flex-col gap-3 rounded-xl border p-3 shadow-sm",
                      field
                        ? "border-border bg-surface"
                        : "border-dashed border-border-strong bg-surface-2",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 text-label font-semibold break-words">
                        {column.header || t("mapping.column", { index: column.index + 1 })}
                      </span>
                      {guessed ? <Badge variant="outline">{t("mapping.guessed")}</Badge> : null}
                      {field?.required ? (
                        <Badge variant="secondary">{t("mapping.required")}</Badge>
                      ) : null}
                      {field ? null : <Badge variant="secondary">{t("mapping.ignored")}</Badge>}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-caption text-ink-3">{t("mapping.samples")}</span>
                      {column.samples.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {column.samples.map((value, position) => (
                            <span
                              key={`${column.index}-${position}`}
                              className="max-w-full truncate rounded-md bg-n-50 px-2 py-0.5 text-caption text-ink-2"
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-caption text-ink-3">{t("mapping.emptyColumn")}</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`column-${column.index}`} className="text-caption text-ink-3">
                        {t("mapping.field")}
                      </Label>
                      <NativeSelect
                        id={`column-${column.index}`}
                        value={fieldKey}
                        onChange={(event) => assign(column.index, event.target.value)}
                      >
                        <option value={NO_FIELD}>{t("mapping.none")}</option>
                        {fields.map((candidate) => (
                          <option key={candidate.key} value={candidate.key}>
                            {candidate.label}
                          </option>
                        ))}
                      </NativeSelect>
                      {field?.help ? <p className="text-caption text-ink-3">{field.help}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {defaultFields.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-1">
                  <h3 className="text-label font-semibold">{t("mapping.defaults")}</h3>
                  <p className="text-caption text-ink-2">{t("mapping.defaultsHelp")}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {defaultFields.map((field) => {
                    const chips = chipsFor(field.key);
                    const current = defaults[field.key] ?? "";
                    const listed = chips.includes(current);
                    const setValue = (value: string) => {
                      setDefaults((state) => ({ ...state, [field.key]: value }));
                      setReport(null);
                    };
                    // A field with a known list is picked from it; « Autre » opens the box that
                    // names a new one, exactly as the contact form does (D44).
                    if (chips.length > 0) {
                      return (
                        <div key={field.key} className="flex flex-col gap-2 sm:col-span-2">
                          <Label>{field.label}</Label>
                          <ToggleGroup
                            type="single"
                            value={listed ? current : current === "" ? "" : OTHER_TRADE}
                            onValueChange={(value) => {
                              if (value === "") return;
                              setValue(value === OTHER_TRADE ? "" : value);
                            }}
                            className="flex flex-wrap gap-2"
                          >
                            {chips.map((chip) => (
                              <ToggleGroupItem key={chip} value={chip} className="min-h-11">
                                {chip}
                              </ToggleGroupItem>
                            ))}
                            <ToggleGroupItem value={OTHER_TRADE} className="min-h-11">
                              {tc("other")}
                            </ToggleGroupItem>
                          </ToggleGroup>
                          {!listed ? (
                            <Input
                              id={`default-${field.key}`}
                              value={current}
                              placeholder={t("mapping.newSpecialty")}
                              autoComplete="off"
                              autoCapitalize="sentences"
                              onChange={(event) => setValue(event.target.value)}
                            />
                          ) : null}
                        </div>
                      );
                    }
                    return (
                      <div key={field.key} className="flex flex-col gap-1.5">
                        <Label htmlFor={`default-${field.key}`}>{field.label}</Label>
                        <Input
                          id={`default-${field.key}`}
                          value={current}
                          placeholder={t("mapping.defaultValue")}
                          autoComplete="off"
                          onChange={(event) => setValue(event.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {unfed.length > 0 ? (
              <p className="text-caption text-ink-3">
                {t("mapping.unmapped", { fields: unfed.map((field) => field.label).join(", ") })}
              </p>
            ) : null}
            {missing.length > 0 ? (
              <Alert>
                <AlertDescription>
                  {t("mapping.missing", { fields: missing.join(", ") })}
                </AlertDescription>
              </Alert>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-h2">{t("steps.preview")}</h2>
            <p className="text-body">{t("preview.plan", plan)}</p>
            {/* Seven columns cannot fit 328 px and stay a table, so it scrolls — and a table that
                scrolls without saying so reads as a table with three columns (F9). */}
            <p className="text-caption text-ink-3 sm:hidden">{tCommon("scrollTable")}</p>
            <div className="relative overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full border-collapse text-caption">
                <thead>
                  <tr className="border-b border-border bg-n-50 text-left">
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      {t("preview.state")}
                    </th>
                    {previewFields.map((field) => (
                      <th key={field.key} className="px-3 py-2 font-medium sm:whitespace-nowrap">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.slice(0, PREVIEW_ROWS).map((values, index) => {
                    const outcome = outcomes[index];
                    return (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <Badge
                              variant={
                                outcome?.kind === "rejected"
                                  ? "destructive"
                                  : outcome?.kind === "updated"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {outcome?.kind === "rejected"
                                ? t("preview.rejected")
                                : outcome?.kind === "updated"
                                  ? t("preview.updated")
                                  : t("preview.new")}
                            </Badge>
                            {outcome?.reason ? (
                              <span className="text-caption text-ink-3">
                                {t(outcome.reason.replace(/^import\./, "") as "errors.noName")}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        {previewFields.map((field) => (
                          <td key={field.key} className="px-3 py-2 text-ink-2 sm:whitespace-nowrap">
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
            {tooMany ? (
              <Alert>
                <AlertDescription>{t("errors.tooMany", { max: IMPORT_MAX_ROWS })}</AlertDescription>
              </Alert>
            ) : null}
          </section>

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

/** Hands a generated file to the browser: the blank template, the refused lines. */
function download(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
