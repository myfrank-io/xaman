"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { TriangleAlertIcon } from "lucide-react";

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

export function DeleteAccountCard() {
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
      <CardContent>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">{t("button")}</Button>
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
