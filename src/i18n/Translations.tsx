import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import type { Namespace } from "@/i18n/namespaces";

/**
 * Hand the client the message groups this part of the app actually reads — and only those.
 *
 * `NextIntlClientProvider` given no `messages` inherits the whole of `fr.json` and serialises it
 * into the RSC payload of every page under it: 88 KB of JSON on a marina connection, for one
 * screen that uses a tenth of it. Nesting is a **replacement**, not a merge (`use-intl`'s
 * `IntlProvider` takes the nearest `messages` and ignores the ones above), so each provider
 * declares a set that stands on its own — the frame's groups in the boat layout, the screen's
 * groups in the section layout under it.
 *
 * The sets live in `src/i18n/slices.ts` and are checked against the import graph by
 * `tests/unit/i18n-slices.test.ts`: a group forgotten here would not fail the build, it would
 * throw `MISSING_MESSAGE` on a screen someone opens at sea.
 */
export async function Translations({
  of,
  children,
}: {
  of: readonly Namespace[];
  children: React.ReactNode;
}) {
  const all = await getMessages();
  const messages: Record<string, unknown> = {};
  for (const namespace of of) messages[namespace] = all[namespace];

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
