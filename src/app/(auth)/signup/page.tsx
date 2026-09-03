import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("title") };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth.signup");
  const next = params.next && params.next.startsWith("/") ? params.next : "/boats";

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <SignupForm next={next} />
    </AuthShell>
  );
}
