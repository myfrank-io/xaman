"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CopyIcon, PencilIcon, RepeatIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { undoToast } from "@/components/common/UndoToast";
import { RecurringItemDialog } from "@/components/logs/RecurringItemDialog";
import type { LogEngineHours } from "@/components/logs/rows";
import { Button } from "@/components/ui/button";
import { trashLog } from "@/lib/actions/logs";
import { restoreLog } from "@/lib/actions/trash";
import { todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { editLogPath, logsPath, newLogPath } from "@/lib/queries/boat-routes";

/**
 * Actions of an intervention (E3-4). A `pro` only ever sees « Modifier », and only on the rows
 * they created: a forbidden action is ABSENT, never greyed out (D23).
 */
export function LogActions({
  boatId,
  log,
  canWrite,
}: {
  boatId: string;
  log: {
    id: string;
    title: string;
    categoryId: string | null;
    contactId: string | null;
    equipmentId: string | null;
    engineHours: LogEngineHours[];
  };
  canWrite: boolean;
}) {
  const t = useTranslations("logs.detail");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [recurring, setRecurring] = useState(false);

  const redoHref = newLogPath(boatId, {
    title: log.title,
    category: log.categoryId ?? undefined,
    contact: log.contactId ?? undefined,
    equipment: log.equipmentId ?? undefined,
    date: todayString(),
  });

  function trash() {
    startTransition(async () => {
      const result = await trashLog({ boatId, logId: log.id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setConfirming(false);
      undoToast({
        message: t("trash.done"),
        undoLabel: t("trash.undo"),
        onUndo: () => {
          void restoreLog({ boatId, id: log.id }).then((undo) => {
            if (!undo.ok) {
              toast.error(errorMessage(undo.error));
              return;
            }
            toast.success(t("trash.restored"));
            router.refresh();
          });
        },
      });
      router.push(logsPath(boatId) as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline">
        <Link href={editLogPath(boatId, log.id) as Route}>
          <PencilIcon />
          {tc("edit")}
        </Link>
      </Button>
      {canWrite ? (
        <>
          <Button asChild variant="outline">
            <Link href={redoHref as Route}>
              <CopyIcon />
              {t("redo")}
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setRecurring(true)}>
            <RepeatIcon />
            {t("recurring.action")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
            <Trash2Icon />
            {t("trash.action")}
          </Button>
          <ConfirmDialog
            open={confirming}
            onOpenChange={setConfirming}
            title={t("trash.title")}
            description={t("trash.description", { title: log.title })}
            confirmLabel={t("trash.confirm")}
            pending={pending}
            onConfirm={trash}
          />
          <RecurringItemDialog
            boatId={boatId}
            logId={log.id}
            title={log.title}
            engineHours={log.engineHours}
            open={recurring}
            onOpenChange={setRecurring}
          />
        </>
      ) : null}
    </div>
  );
}
