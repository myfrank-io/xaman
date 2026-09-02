"use client";

import type { FieldError } from "react-hook-form";
import { useTranslations } from "next-intl";

// Turns a react-hook-form / zod issue into a French sentence (zod's own messages are English).
export function useFieldError() {
  const t = useTranslations("validation");
  return (error: FieldError | undefined): string | undefined => {
    if (!error) return undefined;
    const message = error.message ?? "";
    if (message && t.has(message as Parameters<typeof t>[0])) {
      return t(message as Parameters<typeof t>[0]);
    }
    switch (error.type) {
      case "too_small":
        return t("required");
      case "too_big":
        return t("tooBig");
      case "invalid_type":
        return t("invalidNumber");
      default:
        return t("invalid");
    }
  };
}
