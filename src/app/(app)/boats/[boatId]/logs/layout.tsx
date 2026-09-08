import { Translations } from "@/i18n/Translations";
import { BOAT_SECTIONS } from "@/i18n/slices";

// Only what this section's screens read (D109); the frame's own words stay in the boat layout.
export default function LogsMessagesLayout({ children }: { children: React.ReactNode }) {
  return <Translations of={BOAT_SECTIONS.logs}>{children}</Translations>;
}
