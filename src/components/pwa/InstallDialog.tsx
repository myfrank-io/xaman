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
  /**
   * One instruction per browser, because the gesture genuinely differs and a wrong menu name
   * is worse than none. Safari never fires `beforeinstallprompt` on either platform, so there
   * is no button to offer there — only the system gesture, named exactly.
   */
  const hint = prompt.standalone
    ? t("installed")
    : prompt.promptEvent
      ? t("androidHint")
      : prompt.platform === "ios"
        ? t("iosHint")
        : prompt.platform === "macSafari"
          ? t("macSafariHint")
          : prompt.platform === "firefox"
            ? t("firefoxHint")
            : t("otherHint");
  /**
   * Without a button the text carries the whole answer, and the commonest reason a Chromium
   * browser withholds the prompt is that the app is already installed — which « nothing
   * happened » suggests to nobody.
   */
  const secondHint =
    !prompt.standalone && !prompt.promptEvent && prompt.platform === "chromium"
      ? t("otherHintAlready")
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        {secondHint ? <p className="text-caption text-ink-2">{secondHint}</p> : null}
        {/* Which build is this? One tap, no dev tools — see NEXT_PUBLIC_BUILD in next.config. */}
        <p className="num text-caption text-ink-3">
          {t("build", { build: process.env.NEXT_PUBLIC_BUILD ?? "dev" })}
        </p>
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
