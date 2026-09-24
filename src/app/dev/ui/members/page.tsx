import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { InviteMemberDialog } from "@/components/members/InviteMemberDialog";
import { MembersList, type MemberRow } from "@/components/members/MembersList";

import { DEV_BOAT_ID, DevShell } from "../DevShell";

/**
 * Visual acceptance of the crew screen. Every row carries a name, an e-mail, a role menu, an
 * end date and a remove button — five things on one line, which is the shape that broke on a
 * phone everywhere else in the app. Real-length e-mail addresses on purpose.
 */
const MEMBERS: MemberRow[] = [
  {
    userId: "00000000-0000-4000-8000-0000000000a1",
    role: "owner",
    validUntil: null,
    fullName: "Xavier Marin",
    email: "xavier.marin@exemple.fr",
  },
  {
    userId: "00000000-0000-4000-8000-0000000000a2",
    role: "editor",
    validUntil: null,
    fullName: "Emmanuel Lesaffre",
    email: "emmanuel.lesaffre@exemple.fr",
  },
  {
    userId: "00000000-0000-4000-8000-0000000000a3",
    role: "pro",
    validUntil: "2026-12-31",
    fullName: "Chantier Naval du Guip",
    email: "contact@chantier-naval-du-guip.example.fr",
  },
  {
    userId: "00000000-0000-4000-8000-0000000000a4",
    role: "viewer",
    validUntil: "2026-09-30",
    fullName: null,
    email: "assurance.plaisance.grand-ouest@exemple.fr",
  },
];

export default async function DevMembersPage() {
  const t = await getTranslations("members");

  return (
    <DevShell>
      <div className="flex flex-col gap-8 pb-16">
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          actions={<InviteMemberDialog boatId={DEV_BOAT_ID} inviterRole="owner" />}
        />
        <MembersList
          boatId={DEV_BOAT_ID}
          currentUserId="00000000-0000-4000-8000-0000000000a1"
          canManage
          members={MEMBERS}
        />
      </div>
    </DevShell>
  );
}
