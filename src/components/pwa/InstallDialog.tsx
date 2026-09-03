"use client";

import { useTranslations } from "next-intl";

import type { useInstallPrompt } from "@/components/pwa/use-install-prompt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPrompt = ReturnType<typeof useInstallPrompt>;

// « Installer l'application » from the account menu: the same facts as the banner, on demand.
export function InstallDialog({
  open,
  onOpenChange,
  prompt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: InstallPrompt;
}) {
  const t = useTranslations("install");
  const tc = useTranslations("common");
  const hint = prompt.standalone
    ? t("installed")
    : prompt.ios
      ? t("iosHint")
      : prompt.promptEvent
        ? t("androidHint")
        : t("otherHint");
  /**
   * Without a captured prompt there is no button, so the text has to carry the whole answer —
   * and the commonest reason a Chromium browser withholds the prompt is that the application
   * is already installed, which « nothing happened » does not suggest to anyone.
   */
  const secondHint =
    !prompt.standalone && !prompt.ios && !prompt.promptEvent ? t("otherHintAlready") : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        {secondHint ? <p className="text-caption text-ink-2">{secondHint}</p> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {tc("close")}
            </Button>
          </DialogClose>
          {!prompt.standalone && prompt.promptEvent ? (
            <Button
              type="button"
              onClick={() => {
                void prompt.install().then(() => onOpenChange(false));
              }}
            >
              {t("install")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
