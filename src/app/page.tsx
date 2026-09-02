import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <main className="flex flex-1 flex-col">
      <header className="bg-linear-to-br from-navy to-navy-light px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-12 text-white">
        <div className="mx-auto w-full max-w-4xl">
          <p className="text-sm font-medium tracking-widest text-white/70 uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-3 max-w-xl text-lg text-white/80">{t("subtitle")}</p>
        </div>
      </header>
      <section className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="max-w-md text-center text-base text-muted-foreground">{t("status")}</p>
      </section>
    </main>
  );
}
