"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { changeMemberRole, extendMemberAccess, removeMember } from "@/lib/actions/members";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { formatDate, todayString } from "@/lib/format";
import type { BoatRole } from "@/lib/permissions";
import { boatPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

export type MemberRow = {
  userId: string;
  role: BoatRole;
  validUntil: string | null;
  fullName: string | null;
  email: string;
};

const ROLES: BoatRole[] = ["owner", "editor", "pro", "viewer"];

export function MembersList({
  boatId,
  currentUserId,
  canManage,
  members,
}: {
  boatId: string;
  currentUserId: string;
  canManage: boolean;
  members: MemberRow[];
}) {
  const t = useTranslations("members");
  const te = useTranslations();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toRemove, setToRemove] = useState<MemberRow | null>(null);
  const [lastOwnerBlocked, setLastOwnerBlocked] = useState(false);
  const today = todayString();

  function handleFailure(error: string) {
    setLastOwnerBlocked(error === "errors.last_owner");
    toast.error(errorMessage(error));
  }

  function onRoleChange(member: MemberRow, role: BoatRole) {
    startTransition(async () => {
      const result = await changeMemberRole({ boatId, userId: member.userId, role });
      if (!result.ok) {
        handleFailure(result.error);
        return;
      }
      setLastOwnerBlocked(false);
      toast.success(t("roleUpdated"));
      router.refresh();
    });
  }

  function onRemove(member: MemberRow) {
    startTransition(async () => {
      const result = await removeMember({ boatId, userId: member.userId });
      setToRemove(null);
      if (!result.ok) {
        handleFailure(result.error);
        return;
      }
      setLastOwnerBlocked(false);
      toast.success(t("removed"));
      router.refresh();
    });
  }

  // D29: an expired member is greyed with « Réactiver 90 j »
  function onReactivate(member: MemberRow) {
    startTransition(async () => {
      const result = await extendMemberAccess({ boatId, userId: member.userId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("reactivated"));
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t("list.title", { count: members.length })}</h2>
      {lastOwnerBlocked ? (
        <Alert variant="warning">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {t("lastOwnerHint")}
            <Link
              href={boatPath(boatId, "settings") as Route}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("transferLink")}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      <ul className="divide-y rounded-xl border bg-card shadow-sm">
        {members.map((m) => {
          const expired = m.validUntil !== null && m.validUntil < today;
          return (
            <li
              key={m.userId}
              className={cn("flex flex-wrap items-center gap-3 p-4", expired && "bg-surface-2")}
            >
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium", expired && "text-ink-3")}>
                  {m.fullName ?? m.email}
                  {m.userId === currentUserId ? (
                    <span className="ml-2 text-sm text-muted-foreground">{t("you")}</span>
                  ) : null}
                </p>
                {m.fullName ? (
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                ) : null}
                {m.validUntil ? (
                  <p
                    className={cn(
                      "text-xs",
                      expired ? "font-medium text-state-soon-fg" : "text-muted-foreground",
                    )}
                  >
                    {expired
                      ? t("expired", { date: formatDate(m.validUntil) })
                      : t("validUntil", { date: formatDate(m.validUntil) })}
                  </p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex items-center gap-2">
                  {expired ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => onReactivate(m)}
                    >
                      {t("reactivate")}
                    </Button>
                  ) : null}
                  <NativeSelect
                    aria-label={t("roleLabel")}
                    className="w-40"
                    value={m.role}
                    disabled={pending}
                    onChange={(e) => onRoleChange(m, e.target.value as BoatRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`roles.${r}`)}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("remove")}
                    disabled={pending}
                    onClick={() => setToRemove(m)}
                  >
                    <Trash2Icon className="text-destructive" />
                  </Button>
                </div>
              ) : (
                <Badge variant="secondary">{t(`roles.${m.role}`)}</Badge>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={toRemove !== null} onOpenChange={(open) => !open && setToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("removeDialog.title", { name: toRemove?.fullName ?? toRemove?.email ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("removeDialog.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{te("common.cancel")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => toRemove && onRemove(toRemove)}
            >
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
