import { Translations } from "@/i18n/Translations";
import { AUTH } from "@/i18n/slices";

// The four ways in and the public invitation page share one vocabulary (D110).
export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return <Translations of={AUTH}>{children}</Translations>;
}
