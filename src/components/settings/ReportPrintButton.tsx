"use client";

import { PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

// iPad Safari: Partager → Imprimer gives the PDF; window.print() opens the same sheet.
export function ReportPrintButton() {
  const t = useTranslations("report");
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <PrinterIcon />
      {t("print")}
    </Button>
  );
}
