import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/auth/redirect";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth");
  const next = safeNextPath(params.next);

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <LoginForm
        next={next}
        initialEmail={params.email ?? ""}
        linkError={params.error === "link"}
      />
    </AuthShell>
  );
}
