import { Translations } from "@/i18n/Translations";
import { NEW_BOAT } from "@/i18n/slices";

// Step 1 of opening a carnet: the boat's identity, and nothing about a carnet yet (D109).
export default function NewBoatLayout({ children }: { children: React.ReactNode }) {
  return <Translations of={NEW_BOAT}>{children}</Translations>;
}
