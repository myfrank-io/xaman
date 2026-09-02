"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revokeInvitation } from "@/lib/actions/members";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { formatDate } from "@/lib/format";
import type { BoatRole } from "@/lib/permissions";

export type InvitationStatus = "pending" | "expired" | "accepted" | "revoked";

export type InvitationRow = {
  id: string;
  email: string;
  role: BoatRole;
  status: InvitationStatus;
  expiresAt: string;
  invitedByName: string | null;
};

export function InvitationsList({
  boatId,
  invitations,
}: {
  boatId: string;
  invitations: InvitationRow[];
}) {
  const t = useTranslations("members");
  const te = useTranslations();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const visible = invitations.filter((i) => i.status === "pending" || i.status === "expired");
  if (visible.length === 0) return null;

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
        {visible.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.email}</p>
              <p className="text-sm text-muted-foreground">
                {t(`roles.${i.role}`)} ·{" "}
                {i.status === "expired"
                  ? t("invitations.expired")
                  : t("invitations.expires", { date: formatDate(i.expiresAt) })}
              </p>
            </div>
            <Badge variant={i.status === "expired" ? "outline" : "secondary"}>
              {t(`invitations.status.${i.status}`)}
            </Badge>
            <Button variant="ghost" disabled={pending} onClick={() => revoke(i.id)}>
              {t("invitations.revoke")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
