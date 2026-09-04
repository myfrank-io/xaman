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
 * The catalogue of production models (D68) is read here to suggest builders and model names: the
 * two fields stay free text, and a boat the catalogue has never heard of is written down exactly.
 * The maintenance plan is a separate question, asked at step 3 once the boat exists.
 */
export default async function NewBoatPage() {
  const t = await getTranslations("boats.new");
  const supabase = await createClient();

  const models = await boatModels(supabase);

  return (
    <BoatsShell title={t("title")} subtitle={t("subtitle")}>
      <OnboardingSteps step={1} />
      <NewBoatForm models={models} />
      <p className="text-caption text-ink-2">{t("invited")}</p>
      <div className="mt-auto flex justify-end pt-4">
        <SignOutButton />
      </div>
    </BoatsShell>
  );
}
