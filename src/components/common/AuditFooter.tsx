import { getTranslations } from "next-intl/server";

import { formatDate } from "@/lib/format";

/**
 * « créé par … le … · modifié par … le … » at the foot of a detail sheet (E10-4). The
 * modification line only shows when something changed after creation.
 */
export async function AuditFooter({
  createdByName,
  createdAt,
  updatedByName,
  updatedAt,
}: {
  createdByName: string | null | undefined;
  createdAt: string | null | undefined;
  updatedByName: string | null | undefined;
  updatedAt: string | null | undefined;
}) {
  const t = await getTranslations("common.audit");
  const created = createdAt ? formatDate(createdAt) : null;
  const updated =
    updatedAt && createdAt && updatedAt.slice(0, 16) !== createdAt.slice(0, 16)
      ? formatDate(updatedAt)
      : null;
  if (!created) return null;
  return (
    <p className="border-t border-border pt-3 text-caption text-ink-3">
      {t("created", { name: createdByName || t("unknown"), date: created })}
      {updated ? ` · ${t("updated", { name: updatedByName || t("unknown"), date: updated })}` : ""}
    </p>
  );
}
