"use client";

import { SmartphoneIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useInstallPrompt } from "@/components/pwa/use-install-prompt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// Lowest-priority dashboard banner (ux-flows §2.3 #5): second session onwards, hidden 30 days.
export function InstallBanner() {
  const t = useTranslations("install");
  const { bannerEligible, ios, install, dismiss } = useInstallPrompt();
  if (!bannerEligible) return null;

  return (
    <Alert variant="info">
      <SmartphoneIcon />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{ios ? t("iosHint") : t("androidHint")}</span>
        <span className="flex flex-wrap gap-2">
          {ios ? null : (
            <Button size="sm" onClick={() => void install()}>
              {t("install")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {t("later")}
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}
