import { Translations } from "@/i18n/Translations";
import { BOAT_SECTIONS } from "@/i18n/slices";

// Only what this section's screens read (D109); the frame's own words stay in the boat layout.
export default function DashboardMessagesLayout({ children }: { children: React.ReactNode }) {
  return <Translations of={BOAT_SECTIONS.dashboard}>{children}</Translations>;
}
