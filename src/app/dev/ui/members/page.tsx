import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { InvitationsList, type InvitationRow } from "@/components/members/InvitationsList";
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

/**
 * The four an invitation can be in since D79, in the order they hurt: an address that does not
 * exist (the one that started this — one letter wrong, « En attente » for fourteen days), one
 * still on its way, one received, and an expired one from before the mailer knew anything.
 *
 * Since D110 they also carry their reminders, and that is what to look at here: the bounced one
 * has **no** « Relancer » (nothing will ever reach that address — the red panel below it is the
 * way out), the delivered one has been relaunched twice and says so, and the expired one has
 * never been. Three buttons on one line at 768 px is the shape to check.
 */
const INVITATIONS: InvitationRow[] = [
  {
    id: "00000000-0000-4000-8000-0000000000b0",
    email: "manu.lessafre@exemple.fr",
    role: "editor",
    status: "pending",
    expiresAt: "2026-09-21",
    validUntil: null,
    invitedByName: "Xavier Marin",
    delivery: { status: "bounced", reason: "no_email" },
    remindedAt: null,
    reminderCount: 0,
  },
  {
    id: "00000000-0000-4000-8000-0000000000b1",
    email: "jean-baptiste.de-la-tourelle@exemple.fr",
    role: "pro",
    status: "pending",
    expiresAt: "2026-09-17",
    validUntil: "2027-03-03",
    invitedByName: "Xavier Marin",
    delivery: { status: "delivered", reason: null },
    remindedAt: "2026-09-06T09:12:00.000Z",
    reminderCount: 2,
  },
  {
    id: "00000000-0000-4000-8000-0000000000b3",
    email: "assurance@exemple.fr",
    role: "viewer",
    status: "pending",
    expiresAt: "2026-09-21",
    validUntil: "2026-12-20",
    invitedByName: "Xavier Marin",
    delivery: { status: "sent", reason: null },
    remindedAt: "2026-09-08T07:40:00.000Z",
    reminderCount: 1,
  },
  {
    id: "00000000-0000-4000-8000-0000000000b2",
    email: "expert@exemple.fr",
    role: "viewer",
    status: "expired",
    expiresAt: "2026-08-01",
    validUntil: null,
    invitedByName: "Xavier Marin",
    delivery: null,
    remindedAt: null,
    reminderCount: 0,
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
          actions={<InviteMemberDialog boatId={DEV_BOAT_ID} boatName="Xaman" inviterRole="owner" />}
        />
        <MembersList
          boatId={DEV_BOAT_ID}
          currentUserId="00000000-0000-4000-8000-0000000000a1"
          canManage
          members={MEMBERS}
        />
        <InvitationsList boatId={DEV_BOAT_ID} boatName="Xaman" invitations={INVITATIONS} />
      </div>
    </DevShell>
  );
}
