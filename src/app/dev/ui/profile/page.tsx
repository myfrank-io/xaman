import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { PageHeader } from "@/components/common/PageHeader";
import { PageShell } from "@/components/layout/PageShell";
import { DeleteAccountCard } from "@/components/profile/DeleteAccountCard";
import { PasswordCard } from "@/components/profile/PasswordCard";
import { ProfileForm } from "@/components/profile/ProfileForm";

/**
 * Visual acceptance of the account screen. It had no preview at all, so the touch audit never
 * saw it — including the password card (D45), which is where someone goes when the recovery
 * e-mail cannot reach them. Two states worth seeing: an account free to leave, and one held by
 * a boat it is the last owner of.
 */
export default async function DevProfilePage() {
  const t = await getTranslations("profile");

  return (
    <PageShell>
      <PageHeader
        title={t("title")}
        subtitle="xavier@example.com"
        actions={<SignOutButton variant="outline" />}
      />
      <ProfileForm defaultValues={{ fullName: "Xavier Marin" }} />
      <PasswordCard />
      <DeleteAccountCard blockingBoats={[]} />
      <DeleteAccountCard
        blockingBoats={[{ id: "00000000-0000-4000-8000-000000000000", name: "Xaman" }]}
      />
    </PageShell>
  );
}
