import { Translations } from "@/i18n/Translations";
import { PROFILE } from "@/i18n/slices";

// The account screen lives outside the boat tree and carries its own words (D109).
export default function AccountSettingsLayout({ children }: { children: React.ReactNode }) {
  return <Translations of={PROFILE}>{children}</Translations>;
}
