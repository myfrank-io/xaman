"use client";

import { useTransition } from "react";
import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { exportExpensesCsv } from "@/lib/actions/expenses";
import type { DateRange, ExpenseSource } from "@/lib/expenses";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

/**
 * « Exporter en CSV » (E5-5): the Server Action returns the text, the browser writes the
 * file. An object URL is revoked right after the click, so nothing leaks between exports.
 */
export function ExportExpensesButton({
  boatId,
  range,
  sources,
  disabled,
}: {
  boatId: string;
  range: DateRange;
  sources: ExpenseSource[];
  disabled?: boolean;
}) {
  const t = useTranslations("supplies.expenses");
  const errorMessage = useErrorMessage();
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      const result = await exportExpensesCsv({ boatId, ...range, sources });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.data.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t("exported"));
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={download}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? <Spinner className="size-4" /> : <DownloadIcon />}
      {pending ? t("exporting") : t("export")}
    </Button>
  );
}
