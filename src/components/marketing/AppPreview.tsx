import { getTranslations } from "next-intl/server";

/**
 * A drawn dashboard, not a screenshot.
 *
 * Real screenshots of a private logbook would show a real boat's history, and they go stale on
 * the first design change. This is the same tokens the app uses, so what a visitor sees on the
 * home page is exactly what they get once they sign in — including the rule that a state is
 * never carried by colour alone (rule 12): each line carries its wording too.
 */
export async function AppPreview() {
  const t = await getTranslations("marketing.preview");

  const lines = [
    {
      title: t("lineOne"),
      meta: t("lineOneMeta"),
      badge: t("overdue"),
      tone: "border-state-overdue-border bg-state-overdue-tint text-state-overdue-fg",
    },
    {
      title: t("lineTwo"),
      meta: t("lineTwoMeta"),
      badge: t("soon"),
      tone: "border-state-soon-border bg-state-soon-tint text-state-soon-fg",
    },
    {
      title: t("lineThree"),
      meta: t("lineThreeMeta"),
      badge: t("ok"),
      tone: "border-state-ok-border bg-state-ok-tint text-state-ok-fg",
    },
  ];

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-on-navy-border bg-surface shadow-2xl">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <p className="text-label text-foreground">{t("boat")}</p>
        </div>
        <ul className="divide-y divide-border">
          {lines.map((line) => (
            <li key={line.title} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-label text-foreground">{line.title}</p>
                <p className="mt-0.5 text-caption text-ink-2">{line.meta}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-caption font-medium ${line.tone}`}
              >
                {line.badge}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-caption text-on-navy-3">{t("caption")}</figcaption>
    </figure>
  );
}
