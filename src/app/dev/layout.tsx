import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

/**
 * The design gallery mounts every component of the app on one page, so it is the one surface
 * that legitimately needs the whole message file. It never ships to production (`devUiEnabled`).
 */
export default async function DevLayout({ children }: { children: React.ReactNode }) {
  return <NextIntlClientProvider messages={await getMessages()}>{children}</NextIntlClientProvider>;
}
