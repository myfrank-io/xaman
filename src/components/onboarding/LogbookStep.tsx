"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRightIcon, CheckCircle2Icon, FileSpreadsheetIcon, ImagesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DocumentImport, type DocumentImportLog } from "@/components/attachments/DocumentImport";
import type { CategoryChoice } from "@/components/common/CategoryChips";
import { ImportWizard } from "@/components/import/ImportWizard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EXISTING_LOG_FORMATS, type ExistingLogFormat } from "@/lib/boat-onboarding";

/** The icon of each format — « rien à reprendre » is a word, not a picture. */
const ICONS: Partial<Record<ExistingLogFormat, typeof FileSpreadsheetIcon>> = {
  spreadsheet: FileSpreadsheetIcon,
  paper: ImagesIcon,
};

/**
 * Step 2 of three: « Votre carnet actuel » (D67).
 *
 * The question is the format, and the answer opens the reader that goes with it **on this screen**
 * rather than sending someone off to another one. Leaving the flow to import and finding one's way
 * back is exactly the trip nobody makes: the carnet then stays empty, and an empty carnet is a
 * carnet nobody opens again.
 *
 * `none` is pre-selected and first, because a genuinely new boat — or an owner who would rather
 * type as they go — must not pay a tap for a question that is not theirs. From that answer the
 * step costs one tap: « Continuer ».
 *
 * Nothing here is mandatory. The footer says « Passer cette étape » until something has actually
 * landed, and becomes « Continuer » once it has, so the way forward is never hidden behind an
 * import someone did not want to do.
 */
export function LogbookStep({
  boatId,
  categories,
  logs = [],
  nextHref,
  initialFormat = "none",
}: {
  boatId: string;
  /** The boat's systems: a photographed invoice becomes an intervention, which needs one. */
  categories: CategoryChoice[];
  /** What the carnet already holds — empty on a fresh boat, filled after a spreadsheet import. */
  logs?: DocumentImportLog[];
  nextHref: string;
  /** Forces a panel open, so the design gallery can put all three under the touch audit. */
  initialFormat?: ExistingLogFormat;
}) {
  const t = useTranslations("boats.onboarding.logbook");
  const [format, setFormat] = useState<ExistingLogFormat>(initialFormat);
  const [rows, setRows] = useState(0);
  const [documents, setDocuments] = useState(0);

  const landed = rows > 0 || documents > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <Label htmlFor="logbook-none">{t("question")}</Label>
        <ToggleGroup
          type="single"
          value={format}
          aria-label={t("question")}
          onValueChange={(next) => next && setFormat(next as ExistingLogFormat)}
        >
          {EXISTING_LOG_FORMATS.map((option) => {
            const Icon = ICONS[option];
            return (
              <ToggleGroupItem key={option} value={option} id={`logbook-${option}`}>
                {Icon ? <Icon aria-hidden /> : null}
                {t(`format.${option}` as "format.none")}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <p className="text-caption text-ink-3">{t(`help.${format}` as "help.none")}</p>
      </div>

      {landed ? (
        <p className="flex items-start gap-2 rounded-xl border border-state-ok-border bg-state-ok-tint p-4 text-body">
          <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-state-ok-fg" />
          <span className="min-w-0">
            {rows > 0
              ? t("importedRows", { count: rows })
              : t("importedDocuments", { count: documents })}
          </span>
        </p>
      ) : null}

      {format === "spreadsheet" ? (
        // No `backHref`: the way out of this step is its own footer, and there is no list behind
        // it to go back to — the carnet is minutes old.
        <ImportWizard
          boatId={boatId}
          entity="logs"
          embedded
          onImported={(report) => setRows(report.created + report.updated)}
        />
      ) : null}

      {format === "paper" ? (
        <DocumentImport
          boatId={boatId}
          logs={logs}
          categories={categories}
          canWrite
          headless
          onAttached={(count) => setDocuments((current) => current + count)}
        />
      ) : null}

      <Button asChild size="xl">
        <Link href={nextHref as Route}>
          <ArrowRightIcon />
          {format === "none" || landed ? t("next") : t("skip")}
        </Link>
      </Button>
    </div>
  );
}
