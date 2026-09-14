import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { HistoryIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { Button } from "@/components/ui/button";
import { loadActivity } from "@/lib/queries/activity";
import { activityPath } from "@/lib/queries/boat-routes";
import { readBoatRole } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

/** Une page de fil. « Charger plus » en ajoute une : jamais de défilement infini (E18-3). */
const PAGE_SIZE = 50;
const MAX_ROWS = 500;

/**
 * « Ce qui a bougé », en entier (E18-3, D132).
 *
 * L'écran d'arrivée en montre les dix premières lignes ; celui-ci les montre toutes, dans le même
 * ordre et avec le même vocabulaire. Il n'est pas dans la barre : on y arrive par le fil, et le
 * fil d'Ariane ramène au tableau de bord.
 */
export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const [{ boatId }, { limit: rawLimit }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const limit = Math.min(Math.max(Number(rawLimit) || PAGE_SIZE, PAGE_SIZE), MAX_ROWS);

  const [{ data: role }, rows, t] = await Promise.all([
    readBoatRole(boatId),
    loadActivity(supabase, boatId, limit),
    getTranslations("dashboard.activity"),
  ]);
  if (!role) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("screenTitle")} subtitle={t("screenSubtitle")} />
      {rows.length === 0 ? (
        <EmptyState icon={<HistoryIcon aria-hidden />} title={t("empty")} />
      ) : (
        <>
          <ActivityList rows={rows} />
          {rows.length === limit && limit < MAX_ROWS ? (
            <div>
              <Button asChild variant="outline">
                <Link href={activityPath(boatId, { limit: limit + PAGE_SIZE }) as Route}>
                  {t("more")}
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
