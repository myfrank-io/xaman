import { getRequestConfig } from "next-intl/server";
import { defaultLocale, type Locale } from "./config";

export default getRequestConfig(async () => {
  // V1: a single locale. The profile's `locale` column will drive this once auth exists (E1-7).
  const locale: Locale = defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "Europe/Paris",
  };
});
