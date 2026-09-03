import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeftIcon } from "lucide-react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { PageHeader } from "@/components/common/PageHeader";
import { DeleteAccountCard } from "@/components/profile/DeleteAccountCard";
import { PasswordCard } from "@/components/profile/PasswordCard";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: ownerships }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase
      .from("boat_members")
      .select("boat_id, boats!boat_members_boat_id_fkey(name)")
      .eq("user_id", user.id)
      .eq("role", "owner"),
  ]);
  // D31: boats where this account is the last owner block the deletion; say which and offer a way out.
  const blocking: { id: string; name: string }[] = [];
  for (const membership of ownerships ?? []) {
    const { count } = await supabase
      .from("boat_members")
      .select("user_id", { count: "exact", head: true })
      .eq("boat_id", membership.boat_id)
      .eq("role", "owner")
      .neq("user_id", user.id);
    if (!count) blocking.push({ id: membership.boat_id, name: membership.boats?.name ?? "" });
  }
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-6 py-8">
      <Button asChild variant="ghost" className="w-fit">
        <Link href={"/boats" as Route}>
          <ArrowLeftIcon />
          {tc("back")}
        </Link>
      </Button>
      <PageHeader
        title={t("title")}
        subtitle={profile?.email ?? user.email ?? ""}
        actions={<SignOutButton variant="outline" />}
      />
      <ProfileForm defaultValues={{ fullName: profile?.full_name ?? "" }} />
      <PasswordCard />
      <DeleteAccountCard blockingBoats={blocking} />
    </main>
  );
}
