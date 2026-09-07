import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { BoatsShell } from "@/components/boats/BoatsShell";
import { NewBoatForm } from "@/components/boats/NewBoatForm";
import { OnboardingSteps } from "@/components/onboarding/OnboardingSteps";
import { boatModels } from "@/lib/queries/boat-models";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("boats.new");
  return { title: t("title") };
}

/**
 * Step 1 of three, « Le bateau » (D67, D65, E11-3). The screen someone lands on when they signed
 * up without an invitation — which until now was a waiting room with nothing to wait for.
 *
 * The catalogue of production models (D69) is read here to suggest builders and model names: the
 * two fields stay free text, and a boat the catalogue has never heard of is written down exactly.
 * The maintenance plan is a separate question, asked at step 3 once the boat exists.
 *
 * Two arrivals, two exits (D72). Someone with no boat is *sent* here by /boats and the only way
 * out is to open a carnet — or to sign out. Someone who already keeps one came from « Ajouter un
 * bateau » in the account menu, out of curiosity as often as intent, and there was nothing to
 * change their mind with: no tabs, no back gesture in standalone, no way home. `/boats` is that
 * way home for both shapes — it lands on the dashboard when a single carnet exists, on the
 * picker when several do.
 */
export default async function NewBoatPage() {
  const t = await getTranslations("boats.new");
  const supabase = await createClient();

  const [models, { data: boats }] = await Promise.all([
    boatModels(supabase),
    // RLS answers with the boats this person is a member of; one is enough to have a home.
    supabase.from("boats").select("id").limit(1),
  ]);
  const hasBoat = (boats?.length ?? 0) > 0;

  return (
    <BoatsShell
      title={t("title")}
      subtitle={t("subtitle")}
      back={hasBoat ? { href: "/boats", label: t("back") } : undefined}
    >
      <OnboardingSteps step={1} />
      <NewBoatForm models={models} />
      <p className="text-caption text-ink-2">{t("invited")}</p>
      {/* The escape hatch of an account with nowhere to go. Anyone who has a carnet already
          signs out from the account menu, where it belongs. */}
      {hasBoat ? null : (
        <div className="mt-auto flex justify-end pt-4">
          <SignOutButton />
        </div>
      )}
    </BoatsShell>
  );
}
