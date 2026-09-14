import { getTranslations } from "next-intl/server";

/**
 * The same drawn list as {@link AppPreview}, one altitude up (D121).
 *
 * A fleet screen is where dials and scores usually appear; the rule here is that a count is only
 * shown when tapping it gives back the lines it counted. So the drawing shows counts that name
 * their own subset — « 14 ORC 50 », « 6 sur le même passe-coque » — and never a percentage.
 */
export async function FleetPreview() {
  const t = await getTranslations("marketing.builders.preview");

  const lines = [
    { title: t("lineOne"), meta: t("lineOneMeta") },
    { title: t("lineTwo"), meta: t("lineTwoMeta") },
    { title: t("lineThree"), meta: t("lineThreeMeta") },
  ];

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-on-navy-border bg-surface shadow-2xl">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <p className="text-label text-foreground">{t("fleet")}</p>
        </div>
        <ul className="divide-y divide-border">
          {lines.map((line) => (
            <li key={line.title} className="px-4 py-3">
              <p className="text-label text-foreground">{line.title}</p>
              <p className="mt-0.5 text-caption text-ink-2">{line.meta}</p>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-caption text-on-navy-3">{t("caption")}</figcaption>
    </figure>
  );
}
