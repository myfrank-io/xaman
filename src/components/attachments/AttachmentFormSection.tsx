"use client";

import { useTranslations } from "next-intl";
import { AttachmentPicker } from "./AttachmentPicker";
import type { ComponentProps, ReactNode } from "react";

/** The same entry point for evidence on a checklist point or an intervention. */
export function AttachmentFormSection({
  children,
  ...props
}: ComponentProps<typeof AttachmentPicker> & { children?: ReactNode }) {
  const t = useTranslations("attachments");
  return (
    <section
      aria-label={t("title")}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold">{t("title")}</h2>
        <p className="text-caption text-ink-2">{t("formHelp")}</p>
      </div>
      <AttachmentPicker {...props} />
      {children}
    </section>
  );
}
