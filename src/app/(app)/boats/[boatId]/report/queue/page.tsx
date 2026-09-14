import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { QueueDocument } from "@/components/report/QueueDocument";
import { ReportPrintButton } from "@/components/settings/ReportPrintButton";
import { Button } from "@/components/ui/button";
import { toDateString } from "@/lib/format";
import { reportPath } from "@/lib/queries/boat-routes";
import { readBoatRole, readBoatRow } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

/**
 * Toute la file, pas une page de file : une feuille qu'on emmène doit porter ce qui reste à
 * faire, pas les vingt premières lignes. Même plafond que le tableau de bord.
 */
const QUEUE_LIMIT = 200;

/**
 * La file s'emporte (E18-5, D135).
 *
 * Au ponton on a les mains prises, le réseau est mauvais et l'iPad reste dans son sac. Ce que
 * l'écran d'arrivée montre — ce qui est dû, ce qu'il faut racheter — tient sur une feuille qu'on
 * met dans sa poche ou qu'on envoie au chantier.
 *
 * La page lit, `QueueDocument` dessine, et la mise en page est celle du rapport d'état
 * (E9-2b) : un document imprimable de plus, pas une seconde façon d'en dessiner un.
 */
export default async function QueueReportPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();

  const [{ data: boat }, { data: role }, { data: queue }, t] = await Promise.all([
    readBoatRow(boatId),
    readBoatRole(boatId),
    supabase.rpc("boat_todo_queue", { p_boat_id: boatId, p_limit: QUEUE_LIMIT }),
    getTranslations("report"),
  ]);
  if (!boat || !role) notFound();

  return (
    <QueueDocument
      boatName={boat.name}
      today={toDateString(new Date())}
      rows={queue ?? []}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href={reportPath(boatId) as Route}>{t("queue.stateReport")}</Link>
          </Button>
          <ReportPrintButton />
        </>
      }
    />
  );
}
