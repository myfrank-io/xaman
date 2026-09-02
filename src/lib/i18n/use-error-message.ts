"use client";

import { useTranslations } from "next-intl";

// Server Actions return error keys as plain strings (`errors.forbidden`, …): resolve them here,
// in one place, with a safe fallback when the key is unknown.
export function useErrorMessage() {
  const t = useTranslations();
  return (key: string): string => {
    const k = key as Parameters<typeof t>[0];
    return t.has(k) ? t(k) : t("errors.unknown");
  };
}
