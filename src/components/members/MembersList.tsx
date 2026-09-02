"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

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
import { changeMemberRole, removeMember } from "@/lib/actions/members";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { formatDate } from "@/lib/format";
import type { BoatRole } from "@/lib/permissions";

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

  function onRoleChange(member: MemberRow, role: BoatRole) {
    startTransition(async () => {
      const result = await changeMemberRole({ boatId, userId: member.userId, role });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("roleUpdated"));
      router.refresh();
    });
  }

  function onRemove(member: MemberRow) {
    startTransition(async () => {
      const result = await removeMember({ boatId, userId: member.userId });
      setToRemove(null);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("removed"));
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t("list.title", { count: members.length })}</h2>
      <ul className="divide-y rounded-xl border bg-card shadow-sm">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {m.fullName ?? m.email}
                {m.userId === currentUserId ? (
                  <span className="ml-2 text-sm text-muted-foreground">{t("you")}</span>
                ) : null}
              </p>
              {m.fullName ? (
                <p className="truncate text-sm text-muted-foreground">{m.email}</p>
              ) : null}
              {m.validUntil ? (
                <p className="text-xs text-muted-foreground">
                  {t("validUntil", { date: formatDate(m.validUntil) })}
                </p>
              ) : null}
            </div>
            {canManage ? (
              <div className="flex items-center gap-2">
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
        ))}
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
