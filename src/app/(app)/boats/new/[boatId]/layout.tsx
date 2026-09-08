import { Translations } from "@/i18n/Translations";
import { ONBOARDING } from "@/i18n/slices";

// Steps 2 and 3: the existing logbook to bring over, then the plan and the counters (D110).
export default function OnboardingStepsLayout({ children }: { children: React.ReactNode }) {
  return <Translations of={ONBOARDING}>{children}</Translations>;
}
