import Link from "next/link";
import type { Route } from "next";
import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { InstallBanner } from "@/components/pwa/InstallBanner";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { hourReadingPath, logsPath } from "@/lib/queries/boat-routes";

/**
 * The single contextual banner (ux-flows §2.3). Offline is handled by the app shell and
 * pending drafts arrive with E9-1; here: rows to review › engines never read › install.
 */
export async function DashboardBanner({
  boatId,
  reviewCount,
  noReadingEngines,
  canContribute,
}: {
  boatId: string;
  reviewCount: number;
  noReadingEngines: string[];
  canContribute: boolean;
}) {
  const t = await getTranslations("dashboard");

  if (reviewCount > 0) {
    return (
      <Alert variant="warning" className="items-center">
        <TriangleAlertIcon />
        <AlertTitle className="flex flex-wrap items-center justify-between gap-3">
          {t("review.banner", { count: reviewCount })}
          <Button asChild size="sm" variant="outline">
            <Link href={logsPath(boatId, { review: 1 }) as Route}>{t("review.action")}</Link>
          </Button>
        </AlertTitle>
      </Alert>
    );
  }

  if (noReadingEngines.length > 0 && canContribute) {
    return (
      <Alert variant="warning" className="items-center">
        <TriangleAlertIcon />
        <AlertTitle className="flex flex-wrap items-center justify-between gap-3">
          {t("banner.noReadings", { engines: noReadingEngines.join(", ") })}
          <Button asChild size="sm" variant="outline">
            <Link href={hourReadingPath(boatId) as Route}>{t("banner.noReadingsAction")}</Link>
          </Button>
        </AlertTitle>
      </Alert>
    );
  }

  return <InstallBanner />;
}
