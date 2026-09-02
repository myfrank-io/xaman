"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

/**
 * Destructive confirmation (ux-flows §5.6): names the object, states the
 * consequence with its figures, and announces reversibility. `confirmKeyword`
 * adds a typed confirmation for the irreversible ones (deleting a boat).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmKeyword,
  keywordLabel,
  destructive = true,
  pending = false,
  onConfirm,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmKeyword?: string;
  keywordLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("common");
  const [typed, setTyped] = React.useState("");
  const blocked = Boolean(confirmKeyword) && typed.trim() !== confirmKeyword;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange?.(next);
      }}
    >
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {confirmKeyword ? (
          <div className="grid gap-2">
            <Label htmlFor="confirm-keyword">{keywordLabel ?? t("confirm")}</Label>
            <Input
              id="confirm-keyword"
              value={typed}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel ?? t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={blocked || pending}
            onClick={(event) => {
              if (blocked) event.preventDefault();
              else onConfirm();
            }}
          >
            {pending ? <Spinner /> : null}
            {pending ? t("saving") : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
