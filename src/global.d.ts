import type fr from "./messages/fr.json";
import type { locales } from "./i18n/config";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof locales)[number];
    Messages: typeof fr;
  }
}
