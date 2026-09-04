import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { BoatsShell } from "@/components/boats/BoatsShell";
import { NewBoatForm } from "@/components/boats/NewBoatForm";
import { OnboardingSteps } from "@/components/onboarding/OnboardingSteps";
import type { TemplateOption } from "@/lib/boat-onboarding";
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
 * The published models are read here only to *suggest* builders and model names: the two fields
 * are free text, and a boat whose builder has published nothing is still written down exactly.
 * The maintenance plan is a separate question, asked at step 3 once the boat exists.
 */
export default async function NewBoatPage() {
  const t = await getTranslations("boats.new");
  const supabase = await createClient();

  const { data } = await supabase
    .from("checklist_template_catalog")
    .select("id, name, builder, model, boat_type, category_count, item_count")
    .order("builder", { nullsFirst: false })
    .order("name");

  const templates: TemplateOption[] = (data ?? [])
    .filter((row): row is typeof row & { id: string; name: string } => !!row.id && !!row.name)
    .map((row) => ({
      id: row.id,
      name: row.name,
      builder: row.builder,
      model: row.model,
      boatType: row.boat_type,
      categoryCount: row.category_count ?? 0,
      itemCount: row.item_count ?? 0,
    }));

  return (
    <BoatsShell title={t("title")} subtitle={t("subtitle")}>
      <OnboardingSteps step={1} />
      <NewBoatForm templates={templates} />
      <p className="text-caption text-ink-2">{t("invited")}</p>
      <div className="mt-auto flex justify-end pt-4">
        <SignOutButton />
      </div>
    </BoatsShell>
  );
}
