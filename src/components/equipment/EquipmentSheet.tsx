"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeftIcon, PencilIcon, PlusIcon } from "lucide-react";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge, type LogStatus } from "@/components/common/StatusBadge";
import { Field } from "@/components/forms/Field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { removeEquipment, restoreEquipment } from "@/lib/actions/equipment";
import { formatCurrency, formatDate, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatTabPath, editEquipmentPath, logPath, newLogPath } from "@/lib/queries/boat-routes";

export type EquipmentDetail = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  quantity: number;
  installedAt: string | null;
  removedAt: string | null;
  notes: string | null;
  specs: { key: string; value: string }[];
  category: { id: string; name: string; color: string } | null;
};

export type EquipmentLogRow = {
  id: string;
  title: string;
  performedAt: string;
  status: LogStatus;
  cost: number | null;
  contactName: string | null;
};

export function EquipmentSheet({
  boatId,
  item,
  logs,
  canWrite,
  canContribute,
}: {
  boatId: string;
  item: EquipmentDetail;
  logs: EquipmentLogRow[];
  canWrite: boolean;
  /** A `pro` records his own work here too, but never edits the equipment sheet. */
  canContribute: boolean;
}) {
  const t = useTranslations("equipment");
  const tc = useTranslations("common");
  const tcr = useTranslations("create");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState(false);
  const [removedAt, setRemovedAt] = useState(() => todayString());

  const subtitle = [
    [item.brand, item.model].filter(Boolean).join(" "),
    item.serial ? `${t("fields.serial")} ${item.serial}` : null,
    item.quantity > 1 ? t("quantityShort", { count: item.quantity }) : null,
    item.installedAt ? t("installedOn", { date: formatDate(item.installedAt) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function remove() {
    startTransition(async () => {
      const result = await removeEquipment({ boatId, equipmentId: item.id, removedAt });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("removed"));
      setRemoving(false);
      router.refresh();
    });
  }

  function restore() {
    startTransition(async () => {
      const result = await restoreEquipment({ boatId, equipmentId: item.id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("restored"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={boatTabPath(boatId, "equipment") as Route}>
            <ChevronLeftIcon />
            {t("title")}
          </Link>
        </Button>
        <PageHeader
          className="mt-2"
          title={item.name}
          subtitle={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {item.category ? (
                <span className="inline-flex items-center gap-1.5">
                  <CategoryDot color={item.category.color} />
                  {item.category.name}
                </span>
              ) : (
                <span>{t("uncategorized")}</span>
              )}
              {subtitle ? <span>· {subtitle}</span> : null}
            </span>
          }
          actions={
            canWrite ? (
              <>
                <Button asChild variant="outline">
                  <Link href={editEquipmentPath(boatId, item.id) as Route}>
                    <PencilIcon />
                    {tc("edit")}
                  </Link>
                </Button>
                {item.removedAt ? (
                  <Button type="button" variant="outline" disabled={pending} onClick={restore}>
                    {t("restore")}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setRemoving(true)}>
                    {t("remove")}
                  </Button>
                )}
              </>
            ) : undefined
          }
        />
      </div>

      {item.removedAt ? (
        <Alert variant="info">
          <AlertTitle>{t("removedOn", { date: formatDate(item.removedAt) })}</AlertTitle>
          <AlertDescription>{t("removeDescription")}</AlertDescription>
        </Alert>
      ) : null}

      <SectionCard title={t("fields.specs")}>
        {item.specs.length === 0 ? (
          <p className="px-5 py-4 text-body text-ink-2">{t("noSpecs")}</p>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
            {item.specs.map((spec) => (
              <div key={spec.key} className="flex flex-col">
                <dt className="text-caption font-semibold tracking-wide text-ink-3 uppercase">
                  {spec.key}
                </dt>
                <dd className="text-body text-foreground">{spec.value || tc("none")}</dd>
              </div>
            ))}
          </dl>
        )}
      </SectionCard>

      <SectionCard title={t("fields.notes")}>
        <p className="px-5 py-4 text-body whitespace-pre-wrap text-foreground">
          {item.notes || <span className="text-ink-3">{tc("none")}</span>}
        </p>
      </SectionCard>

      {/* The act starts where the subject is named (D35): the form opens with this piece of
          equipment and its category already chosen. */}
      <SectionCard
        title={t("history")}
        action={
          canContribute ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={
                  newLogPath(boatId, {
                    equipment: item.id,
                    category: item.category?.id,
                  }) as Route
                }
              >
                <PlusIcon />
                {tcr("onEquipment")}
              </Link>
            </Button>
          ) : undefined
        }
      >
        {logs.length === 0 ? (
          <p className="px-5 py-4 text-body text-ink-2">{t("noHistory")}</p>
        ) : (
          logs.map((log) => (
            <ListRow
              key={log.id}
              lead={<StatusBadge status={log.status} />}
              title={log.title}
              meta={[formatDate(log.performedAt), log.contactName].filter(Boolean).join(" · ")}
              trailing={
                log.cost !== null ? (
                  <span className="num text-body font-medium">{formatCurrency(log.cost)}</span>
                ) : null
              }
              href={logPath(boatId, log.id)}
            />
          ))
        )}
      </SectionCard>

      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeTitle", { name: item.name })}</DialogTitle>
            <DialogDescription>{t("removeDescription")}</DialogDescription>
          </DialogHeader>
          <Field id="equipment-removed-at" label={t("removedAt")} required>
            <DateField
              id="equipment-removed-at"
              value={removedAt}
              onValueChange={setRemovedAt}
              max={todayString()}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {tc("cancel")}
              </Button>
            </DialogClose>
            <Button type="button" disabled={pending} onClick={remove} aria-busy={pending}>
              {pending ? <Spinner /> : null}
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
