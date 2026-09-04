import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BoatsShell } from "@/components/boats/BoatsShell";
import { LogbookStep } from "@/components/onboarding/LogbookStep";
import { OnboardingSteps } from "@/components/onboarding/OnboardingSteps";
import { TourStep } from "@/components/onboarding/TourStep";
import { parseOnboardingBoatStep } from "@/lib/boat-onboarding";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath, onboardingPath } from "@/lib/queries/boat-routes";
import { boatPlanChoice } from "@/lib/queries/boat-plan";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** How far back the picker of existing interventions goes; a fresh carnet rarely fills it. */
const RECENT_LOGS = 200;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("boats.onboarding");
  return { title: t("title") };
}

/**
 * Steps 2 and 3 of opening a carnet (D67): « Votre carnet actuel » and « Comment ça marche ».
 *
 * Under `/boats/new` and inside `BoatsShell` rather than in the boat's own tree, because that
 * tree is `AppShell`: landing there would put the four tabs on screen and invite someone to
 * wander off two screens before the end. The four tabs appear once — at « Ouvrir mon carnet ».
 *
 * The boat id is in the address, so both steps survive a closed tab, and the dashboard can send
 * an unfinished carnet back here instead of leaving it to be found by accident.
 *
 * Owner and editor only, like everything these steps write.
 */
export default async function OnboardingStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ boatId }, { step: rawStep }] = await Promise.all([params, searchParams]);
  const step = parseOnboardingBoatStep(rawStep);

  const supabase = await createClient();
  const [{ data: boat }, { data: role }] = await Promise.all([
    supabase.from("boats").select("name, checklist_template_id").eq("id", boatId).maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
  ]);
  // RLS hides a boat this person is not a member of, so a missing row is a refusal.
  if (!boat || !role || !can(role as BoatRole, "write")) notFound();

  const t = await getTranslations("boats.onboarding");

  if (step === 2) {
    const [{ data: categories }, { data: logs }] = await Promise.all([
      // The systems copied at creation: a photographed invoice becomes an intervention, and an
      // intervention is filed under one of them.
      supabase
        .from("boat_categories")
        .select("id, name, color, icon")
        .eq("boat_id", boatId)
        .eq("is_active", true)
        .order("sort_order"),
      // Usually none — the carnet is minutes old. But someone who imported a spreadsheet and came
      // back for the invoices must be able to file a photo onto the line it belongs to.
      supabase
        .from("maintenance_logs_view")
        .select("id, title, performed_at")
        .eq("boat_id", boatId)
        .order("performed_at", { ascending: false })
        .limit(RECENT_LOGS),
    ]);

    return (
      <BoatsShell title={boat.name} subtitle={t("logbook.subtitle")}>
        <OnboardingSteps step={2} />
        <LogbookStep
          boatId={boatId}
          categories={categories ?? []}
          logs={(logs ?? []).map((log) => ({
            id: log.id ?? "",
            title: log.title ?? "",
            performedAt: log.performed_at ?? "",
          }))}
          nextHref={onboardingPath(boatId, 3)}
        />
      </BoatsShell>
    );
  }

  // `boatPlanChoice` answers `null` the moment a plan is set — a resumed step 3 then shows the
  // lesson with its answer already given rather than offering to apply a second model.
  const [plan, { data: engines }] = await Promise.all([
    boatPlanChoice(supabase, boatId),
    supabase
      .from("engines")
      .select("id, label")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return (
    <BoatsShell title={boat.name} subtitle={t("tour.subtitle")}>
      <OnboardingSteps step={3} />
      <TourStep
        boatId={boatId}
        templates={plan?.templates ?? []}
        suggestedTemplateId={plan?.suggestedTemplateId ?? null}
        hasPlan={boat.checklist_template_id !== null}
        engines={engines ?? []}
        dashboardHref={boatPath(boatId, "dashboard")}
      />
    </BoatsShell>
  );
}
