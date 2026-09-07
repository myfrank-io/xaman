import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { devUiEnabled } from "@/lib/dev-ui";

/**
 * Visual acceptance of « mot de passe oublié » (D78), whose second face — the recovery code —
 * only appears once an e-mail has actually gone out, so it had never been looked at. Both are
 * shown: the address asked for, and the code typed back.
 */
export default async function DevForgotPasswordPage() {
  if (!devUiEnabled()) notFound();
  const t = await getTranslations("auth.forgot");
  return (
    <div className="flex flex-col">
      <AuthShell title={t("title")} subtitle={t("subtitle")}>
        <ForgotPasswordForm />
      </AuthShell>
      <AuthShell title={t("title")} subtitle={t("subtitle")}>
        <ForgotPasswordForm initialStep={{ name: "code", email: "xavier@exemple.fr" }} />
      </AuthShell>
    </div>
  );
}
