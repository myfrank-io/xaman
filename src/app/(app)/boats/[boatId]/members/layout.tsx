import { Translations } from "@/i18n/Translations";
import { BOAT_SECTIONS } from "@/i18n/slices";

// Only what this section's screens read (D110); the frame's own words stay in the boat layout.
export default function MembersMessagesLayout({ children }: { children: React.ReactNode }) {
  return <Translations of={BOAT_SECTIONS.members}>{children}</Translations>;
}
