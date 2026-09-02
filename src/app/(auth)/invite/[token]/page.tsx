import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SailboatIcon } from "lucide-react";

import { AcceptInvitation } from "@/components/members/AcceptInvitation";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("title") };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const tr = await getTranslations("members.roles");
  const supabase = await createClient();

  const [{ data: previews }, { data: userData }] = await Promise.all([
    supabase.rpc("get_invitation_preview", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const preview = previews?.[0];
  const user = userData.user;
  const userEmail = user?.email?.toLowerCase() ?? null;

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="bg-header-gradient px-6 pt-8 safe-top pb-10 text-white">
        <div className="mx-auto w-full max-w-md">
          <p className="text-xs font-medium tracking-widest text-white/60 uppercase">Xaman</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
      </header>
      <section className="flex flex-1 justify-center px-6 py-8">
        <div className="flex w-full max-w-md flex-col gap-6">
          {!preview ? (
            <Alert variant="destructive">
              <AlertTitle>{t("invalid.title")}</AlertTitle>
              <AlertDescription>{t("invalid.description")}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-header-gradient text-white">
                  <SailboatIcon className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{preview.boat_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("summary", { inviter: preview.inviter_name ?? "", role: tr(preview.role) })}
                  </p>
                </div>
              </div>

              {preview.status !== "pending" ? (
                <Alert variant="warning">
                  <AlertTitle>
                    {t(`status.${preview.status as "accepted" | "revoked" | "expired"}`)}
                  </AlertTitle>
                </Alert>
              ) : !user ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm">{t("signInHint", { email: preview.email })}</p>
                  <LoginForm next={`/invite/${token}`} initialEmail={preview.email} allowSignup />
                </div>
              ) : userEmail !== preview.email.toLowerCase() ? (
                <div className="flex flex-col gap-4">
                  <Alert variant="warning">
                    <AlertTitle>{t("mismatch.title")}</AlertTitle>
                    <AlertDescription>
                      {t("mismatch.description", {
                        current: userEmail ?? "",
                        invited: preview.email,
                      })}
                    </AlertDescription>
                  </Alert>
                  <SignOutButton variant="outline" />
                </div>
              ) : (
                <AcceptInvitation token={token} boatName={preview.boat_name ?? ""} />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
