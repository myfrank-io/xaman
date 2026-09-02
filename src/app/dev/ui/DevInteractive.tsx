"use client";

import * as React from "react";
import { CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { undoToast } from "@/components/common/UndoToast";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericField } from "@/components/ui/numeric-field";
import { todayString } from "@/lib/format";

export function DevFields({ categories }: { categories: CategoryChoice[] }) {
  const t = useTranslations("dev.sample");
  const tc = useTranslations("common");
  const [date, setDate] = React.useState(todayString());
  const [category, setCategory] = React.useState(categories[0]?.id ?? "");
  const [hours, setHours] = React.useState("1234,5");

  return (
    <div className="grid gap-5 rounded-xl border border-border bg-surface p-5 lg:grid-cols-2">
      <div className="grid gap-2 lg:col-span-2">
        <Label htmlFor="dev-cat">{t("categoryLabel")}</Label>
        <CategoryChips
          categories={categories}
          value={category}
          onValueChange={setCategory}
          label={t("categoryLabel")}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dev-date">{t("dateLabel")}</Label>
        <DateField id="dev-date" value={date} onValueChange={setDate} max={todayString()} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dev-hours">{t("hoursLabel")}</Label>
        <NumericField
          id="dev-hours"
          value={hours}
          suffix="h"
          onValueChange={(raw) => setHours(raw)}
          enterKeyHint="next"
        />
        <p className="text-caption text-ink-3">{tc("optional")}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dev-cost">{t("costLabel")}</Label>
        <NumericField id="dev-cost" defaultValue="148,20" suffix="€" enterKeyHint="done" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="dev-title">{t("title")}</Label>
        <Input id="dev-title" defaultValue={t("title")} aria-invalid aria-describedby="dev-err" />
        <p id="dev-err" className="flex items-center gap-1.5 text-caption text-danger-fg">
          <CircleAlertIcon className="size-3.5" aria-hidden />
          Les heures saisies sont inférieures au dernier relevé (708 h).
        </p>
      </div>
    </div>
  );
}

export function DevOverlays() {
  const t = useTranslations("dev.sample");
  const tc = useTranslations("common");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <div className="flex flex-wrap gap-3">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">{t("openDialog")}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="dev-dialog-hours">{t("hoursLabel")}</Label>
            <NumericField id="dev-dialog-hours" defaultValue="1234,5" suffix="h" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="xl">
                {tc("cancel")}
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button size="xl">{tc("save")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        trigger={<Button variant="outline">{t("confirmDialog")}</Button>}
        title={t("confirmTitle")}
        description={t("confirmDescription")}
        confirmLabel={t("confirmAction")}
        onConfirm={() => setConfirmOpen(false)}
      />

      <Button variant="secondary" onClick={() => toast.success(t("toastMessage"))}>
        {t("toast")}
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          undoToast({
            message: t("undoMessage"),
            description: t("undoDescription"),
            undoLabel: tc("cancel"),
            onUndo: () => toast.dismiss(),
          })
        }
      >
        {t("undoToast")}
      </Button>
    </div>
  );
}
