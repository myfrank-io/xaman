"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MailWarningIcon, RotateCwIcon, SendIcon } from "lucide-react";

import { InviteMemberDialog } from "@/components/members/InviteMemberDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resendInvitation, revokeInvitation } from "@/lib/actions/members";
import {
  deliveryFailed,
  type DeliveryReason,
  type DeliveryStatus,
} from "@/lib/email/delivery-status";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { formatDate } from "@/lib/format";
import { canRemind, type InvitationStatus } from "@/lib/invitations";
import type { BoatRole } from "@/lib/permissions";

/** What became of the e-mail (D79). Null when the app did not send it: unknown, not delivered. */
export type InvitationDelivery = { status: DeliveryStatus; reason: DeliveryReason | null };

export type InvitationRow = {
  id: string;
  email: string;
  role: BoatRole;
  status: InvitationStatus;
  expiresAt: string;
  validUntil: string | null;
  invitedByName: string | null;
  delivery: InvitationDelivery | null;
  /** D109: when the invitation was last resent by hand, and how many times in all. */
  remindedAt: string | null;
  reminderCount: number;
};

/** The three that are a note at the end of the line rather than an alert under it (D79). */
const NOTE: Partial<Record<DeliveryStatus, "sent" | "delivered" | "delayed">> = {
  sent: "sent",
  delivered: "delivered",
  delayed: "delayed",
};

export function InvitationsList({
  boatId,
  boatName,
  invitations,
}: {
  boatId: string;
  boatName: string;
  invitations: InvitationRow[];
}) {
  const t = useTranslations("members");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const visible = invitations.filter((i) => i.status === "pending" || i.status === "expired");
  if (visible.length === 0) return null;

  /**
   * D109: the same invitation, sent again to the same address. The server owns the rules — an
   * hour between two reminders, nothing to an address that bounced — and answers with the
   * sentence to show; here there is only the message that it left.
   */
  function resend(id: string, email: string) {
    startTransition(async () => {
      const result = await resendInvitation({ boatId, invitationId: id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("invitations.resent", { email }));
      router.refresh();
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeInvitation({ boatId, invitationId: id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("invitations.revoked"));
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t("invitations.title")}</h2>
      <ul className="divide-y rounded-xl border bg-card shadow-sm">
        {visible.map((i) => {
          // A bounce outranks « En attente » on the badge: waiting is exactly what it is not.
          const failure =
            i.delivery && deliveryFailed(i.delivery.status) ? i.delivery.status : null;
          const note = i.delivery && !failure ? NOTE[i.delivery.status] : undefined;
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-3 p-4">
              {/* Same shape as a member row, same fix: an invitation is identified by an e-mail
                address, which is the longest string in the app and the first thing a phone
                cuts. It gets the whole row, and the badge and « Annuler » go underneath. */}
              <div className="min-w-0 flex-1 basis-full sm:basis-0">
                <p className="font-medium break-all sm:truncate">{i.email}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`roles.${i.role}`)} ·{" "}
                  {i.status === "expired"
                    ? t("invitations.expired")
                    : t("invitations.expires", { date: formatDate(i.expiresAt) })}
                  {i.validUntil ? ` · ${t("validUntil", { date: formatDate(i.validUntil) })}` : ""}
                  {note ? ` · ${t(`invitations.delivery.${note}`)}` : ""}
                  {i.remindedAt
                    ? ` · ${t("invitations.reminded", {
                        count: i.reminderCount,
                        date: formatDate(i.remindedAt),
                      })}`
                    : ""}
                </p>
              </div>
              {/* gap-2 under 640 px, and not by taste: badge + « Relancer » + « Annuler » measure
                  309 px on the narrowest phone, which is exactly the width available — with
                  gap-3 the last one wraps to a line of its own. */}
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
                <Badge
                  variant={failure ? "danger" : i.status === "expired" ? "outline" : "secondary"}
                >
                  {failure
                    ? t(`invitations.delivery.badge.${failure}`)
                    : t(`invitations.status.${i.status}`)}
                </Badge>
                {/* D109: waiting is not an action. « Relancer » is the one an owner has for
                    somebody who never opened the message — the same link, fourteen days more.
                    It disappears for an address that bounced or pressed « spam »: nothing more
                    will reach it, and the red panel below offers the only real way out. */}
                {canRemind({ status: i.status, delivery: i.delivery?.status ?? null }) ? (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => resend(i.id, i.email)}
                  >
                    <RotateCwIcon />
                    {t("invitations.resend")}
                  </Button>
                ) : null}
                <Button variant="ghost" disabled={pending} onClick={() => revoke(i.id)}>
                  {t("invitations.revoke")}
                </Button>
              </div>
              {/* The whole point of D79: what the mailer knew three seconds after the send, said
                  where the invitation is read — with the way out under it, address in hand. */}
              {failure ? (
                <Alert variant="destructive" className="basis-full">
                  <MailWarningIcon />
                  <AlertTitle>{t(`invitations.delivery.title.${failure}`)}</AlertTitle>
                  <AlertDescription>
                    <p>{t(`invitations.delivery.reasons.${i.delivery?.reason ?? "unknown"}`)}</p>
                    <InviteMemberDialog
                      boatId={boatId}
                      boatName={boatName}
                      inviterRole="owner"
                      defaultEmail={i.email}
                      defaultRole={i.role === "renter" ? undefined : i.role}
                      title={t("invitations.delivery.reinviteTitle", { email: i.email })}
                      description={t("invitations.delivery.reinviteDescription")}
                      trigger={
                        <Button type="button" variant="outline" size="sm" className="mt-1">
                          <SendIcon />
                          {t("invitations.delivery.reinvite")}
                        </Button>
                      }
                    />
                  </AlertDescription>
                </Alert>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
