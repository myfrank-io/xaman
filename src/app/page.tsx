import { getTranslations } from "next-intl/server";

import { XamanLogotype } from "@/components/brand/XamanLogotype";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <main className="flex flex-1 flex-col">
      <header className="bg-header-gradient px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-12 text-on-navy">
        <div className="mx-auto w-full max-w-4xl">
          <p className="text-overline text-brass-light uppercase">{t("eyebrow")}</p>
          <h1 className="mt-4">
            <XamanLogotype className="h-14" title={t("title")} />
          </h1>
          <p className="mt-4 max-w-xl text-body-lg text-on-navy-2">{t("subtitle")}</p>
        </div>
      </header>
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="max-w-md text-center text-body text-ink-2">{t("status")}</p>
      </section>
    </main>
  );
}
