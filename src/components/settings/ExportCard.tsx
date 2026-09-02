"use client";

import { useState, useTransition } from "react";
import { DownloadIcon, FileJsonIcon, FileSpreadsheetIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { exportBoat, type BoatExport } from "@/lib/actions/export";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Export (E9-2): one action builds the three files, then each one downloads on demand.
export function ExportCard({ boatId }: { boatId: string }) {
  const t = useTranslations("settings.export");
  const errorMessage = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [bundle, setBundle] = useState<BoatExport | null>(null);

  function generate() {
    startTransition(async () => {
      const result = await exportBoat({ boatId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setBundle(result.data);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-body text-ink-2">{t("guarantee")}</p>
      {bundle ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => download(`${bundle.basename}.json`, bundle.json, "application/json")}
          >
            <FileJsonIcon />
            {t("json")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              download(
                `${bundle.basename}-interventions.csv`,
                bundle.interventionsCsv,
                "text/csv;charset=utf-8",
              )
            }
          >
            <FileSpreadsheetIcon />
            {t("interventions")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              download(
                `${bundle.basename}-depenses.csv`,
                bundle.depensesCsv,
                "text/csv;charset=utf-8",
              )
            }
          >
            <FileSpreadsheetIcon />
            {t("expenses")}
          </Button>
        </div>
      ) : (
        <div>
          <Button type="button" onClick={generate} disabled={pending} aria-busy={pending}>
            {pending ? <Spinner className="size-4" /> : <DownloadIcon />}
            {pending ? t("generating") : t("button")}
          </Button>
        </div>
      )}
    </div>
  );
}
