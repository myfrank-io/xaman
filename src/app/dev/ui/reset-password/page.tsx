import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { devUiEnabled } from "@/lib/dev-ui";

/**
 * Visual acceptance of the end of the recovery link — the screen someone reaches when they
 * have forgotten their password, and the one screen that cannot be opened without a live
 * recovery session, so it had never been looked at. Both faces are shown: a valid link, and
 * an expired one.
 */
export default async function DevResetPasswordPage() {
  if (!devUiEnabled()) notFound();
  const t = await getTranslations("auth.reset");
  return (
    <div className="flex flex-col">
      <AuthShell title={t("title")} subtitle={t("subtitle")}>
        <ResetPasswordForm initialState="ok" />
      </AuthShell>
      <AuthShell title={t("title")} subtitle={t("subtitle")}>
        <ResetPasswordForm initialState="expired" />
      </AuthShell>
    </div>
  );
}
