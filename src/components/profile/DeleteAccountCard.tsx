"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { deleteAccount } from "@/lib/actions/profile";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

export function DeleteAccountCard({
  blockingBoats,
}: {
  /** Boats whose only owner is this account (D31): transfer or delete them first. */
  blockingBoats: { id: string; name: string }[];
}) {
  const t = useTranslations("profile.delete");
  const te = useTranslations();
  const errorMessage = useErrorMessage();
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();
  const keyword = t("keyword");

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlertIcon className="size-5 text-destructive" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {blockingBoats.map((boat) => (
          <Alert key={boat.id} variant="warning">
            <AlertTitle>{t("blockedTitle", { boat: boat.name })}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {t("blockedDescription")}
              <Link
                href={`/boats/${boat.id}/settings` as Route}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("transfer")}
              </Link>
              <Link
                href={`/boats/${boat.id}/settings` as Route}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("deleteBoat")}
              </Link>
            </AlertDescription>
          </Alert>
        ))}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" disabled={blockingBoats.length > 0}>
              {t("button")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialogTitle")}</DialogTitle>
              <DialogDescription>{t("dialogDescription", { keyword })}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="delete-confirm">{t("confirmLabel")}</Label>
              <Input
                id="delete-confirm"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{te("common.cancel")}</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={pending || confirmation.trim().toUpperCase() !== keyword.toUpperCase()}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteAccount();
                    if (result && !result.ok) toast.error(errorMessage(result.error));
                  })
                }
              >
                {t("button")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
