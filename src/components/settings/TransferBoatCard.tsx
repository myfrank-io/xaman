"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightLeftIcon, CheckIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Field } from "@/components/forms/Field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { inviteNewOwner, leaveBoat, revokeInvitation } from "@/lib/actions/members";
import { formatDate } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatPath } from "@/lib/queries/boat-routes";
import { inviteNewOwnerSchema } from "@/lib/schemas/members";

export type OwnerInvitation = { id: string; email: string; expiresAt: string };

/**
 * Transfer (E1-8, D30) in three explicit steps: what leaves with the boat, export first,
 * invite the new owner as `owner`, then leave once they have accepted. Nothing is destroyed:
 * the logbook simply follows the boat.
 */
export function TransferBoatCard({
  boatId,
  boatName,
  otherOwners,
  pendingInvitations,
}: {
  boatId: string;
  boatName: string;
  otherOwners: number;
  pendingInvitations: OwnerInvitation[];
}) {
  const t = useTranslations("settings.transfer");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [leaving, setLeaving] = useState(false);
  const [pending, startTransition] = useTransition();

  function invite(event: React.FormEvent) {
    event.preventDefault();
    const parsed = inviteNewOwnerSchema.safeParse({ boatId, email });
    if (!parsed.success) {
      setError(t("emailInvalid"));
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await inviteNewOwner(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("invited", { email: parsed.data.email }));
      setEmail("");
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
      router.refresh();
    });
  }

  function leave() {
    startTransition(async () => {
      const result = await leaveBoat({ boatId });
      if (result && !result.ok) {
        setLeaving(false);
        toast.error(errorMessage(result.error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <Alert variant="warning">
        <AlertTitle>{t("warningTitle")}</AlertTitle>
        <AlertDescription>{t("warningDescription")}</AlertDescription>
      </Alert>
      <ol className="flex flex-col gap-4">
        <li className="flex flex-col gap-2">
          <p className="text-body font-medium">{t("step1")}</p>
          <p className="text-caption text-ink-2">{t("step1Help")}</p>
        </li>
        <li className="flex flex-col gap-2">
          <p className="text-body font-medium">{t("step2")}</p>
          <form onSubmit={invite} noValidate className="flex flex-wrap items-end gap-3">
            <Field id="transfer-email" label={t("email")} error={error} className="min-w-64 flex-1">
              <Input
                id="transfer-email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={error ? true : undefined}
              />
            </Field>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? <Spinner className="size-4" /> : <ArrowRightLeftIcon />}
              {t("invite")}
            </Button>
          </form>
          {pendingInvitations.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {pendingInvitations.map((invitation) => (
                <li key={invitation.id} className="flex min-h-12 items-center gap-3 px-3">
                  <span className="min-w-0 flex-1 truncate text-body">{invitation.email}</span>
                  <span className="num text-caption text-ink-2">
                    {t("expires", { date: formatDate(invitation.expiresAt) })}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => revoke(invitation.id)}
                  >
                    {t("revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
        <li className="flex flex-col gap-2">
          <p className="text-body font-medium">{t("step3")}</p>
          <p className="text-caption text-ink-2">
            {otherOwners > 0 ? t("step3Ready", { count: otherOwners }) : t("step3Waiting")}
          </p>
          {otherOwners > 0 ? (
            <div>
              <ConfirmDialog
                open={leaving}
                onOpenChange={setLeaving}
                trigger={
                  <Button type="button" variant="outline">
                    <CheckIcon />
                    {t("leave")}
                  </Button>
                }
                title={t("leaveTitle", { name: boatName })}
                description={t("leaveDescription")}
                confirmLabel={t("leave")}
                cancelLabel={tc("cancel")}
                pending={pending}
                onConfirm={leave}
              />
            </div>
          ) : (
            <Link
              href={boatPath(boatId, "members") as Route}
              className="text-label font-medium text-primary"
            >
              {t("membersLink")}
            </Link>
          )}
        </li>
      </ol>
    </div>
  );
}
