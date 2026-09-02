import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SailboatIcon } from "lucide-react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { EmptyState } from "@/components/common/EmptyState";
import { createClient } from "@/lib/supabase/server";

// After login: one boat → its dashboard, several → selector, none → waiting page (BACKLOG E1-3, E10-2).
export default async function BoatsPage() {
  const supabase = await createClient();
  const { data: boats } = await supabase
    .from("boats")
    .select("id, name, builder, model")
    .order("name");
  const t = await getTranslations("boats");

  if (boats && boats.length === 1 && boats[0]) {
    redirect(`/boats/${boats[0].id}/dashboard`);
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-header-gradient px-6 pt-8 safe-top pb-10 text-white">
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-xs font-medium tracking-widest text-white/60 uppercase">Xaman</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
      </header>
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-8">
        {boats && boats.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {boats.map((boat) => (
              <li key={boat.id}>
                <Link
                  href={`/boats/${boat.id}/dashboard` as Route}
                  className="flex min-h-20 items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-header-gradient text-white">
                    <SailboatIcon className="size-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-semibold">{boat.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[boat.builder, boat.model].filter(Boolean).join(" ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<SailboatIcon />}
            title={t("none.title")}
            description={t("none.description")}
          />
        )}
        <div className="mt-auto flex justify-end">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
