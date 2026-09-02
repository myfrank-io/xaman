import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/LoginForm";

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
  const next = params.next && params.next.startsWith("/") ? params.next : "/boats";

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-header-gradient px-6 pt-8 safe-top pb-10 text-white">
        <div className="mx-auto w-full max-w-md">
          <p className="text-xs font-medium tracking-widest text-white/60 uppercase">Xaman</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-white/75">{t("subtitle")}</p>
        </div>
      </header>
      <section className="flex flex-1 justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <LoginForm
            next={next}
            initialEmail={params.email ?? ""}
            linkError={params.error === "link"}
          />
        </div>
      </section>
    </main>
  );
}
