"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRightIcon, SendIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MemberDetailsDialog } from "@/components/members/MemberDetailsDialog";
import { reissueCredentials } from "@/lib/actions/members";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { formatDate, todayString } from "@/lib/format";
import type { BoatRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export type MemberRow = {
  userId: string;
  role: BoatRole;
  validUntil: string | null;
  fullName: string | null;
  email: string;
  lastSignInAt: string | null;
  credentialsSentCount: number;
  credentialsSentAt: string | null;
};

/**
 * Two lists, as before D151 (D154): those who have opened the carnet, and those still sitting on
 * the credentials they were sent — with when, and how many relances. A row says who, what and
 * until when; everything that changes it lives on the member's card, one tap away.
 */
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
  const [open, setOpen] = useState<MemberRow | null>(null);

  const joined = members.filter((m) => m.userId === currentUserId || m.lastSignInAt);
  const waiting = members.filter((m) => m.userId !== currentUserId && !m.lastSignInAt);

  return (
    <div className="flex flex-col gap-8">
      <Section title={t("list.joined", { count: joined.length })}>
        {joined.map((m) => (
          <Row
            key={m.userId}
            boatId={boatId}
            member={m}
            self={m.userId === currentUserId}
            canManage={canManage}
            onOpen={() => setOpen(m)}
          />
        ))}
      </Section>
      {waiting.length > 0 ? (
        <Section title={t("list.waiting", { count: waiting.length })} hint={t("list.waitingHint")}>
          {waiting.map((m) => (
            <Row
              key={m.userId}
              boatId={boatId}
              member={m}
              self={false}
              canManage={canManage}
              onOpen={() => setOpen(m)}
            />
          ))}
        </Section>
      ) : null}
      <MemberDetailsDialog
        boatId={boatId}
        member={open}
        onOpenChange={(next) => !next && setOpen(null)}
      />
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      <ul className="divide-y rounded-xl border bg-card shadow-sm">{children}</ul>
    </section>
  );
}

function Row({
  boatId,
  member: m,
  self,
  canManage,
  onOpen,
}: {
  boatId: string;
  member: MemberRow;
  self: boolean;
  canManage: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("members");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const expired = m.validUntil !== null && m.validUntil < todayString();
  const waiting = !self && !m.lastSignInAt;
  const editable = canManage && !self;

  const access =
    m.role === "owner"
      ? null
      : m.validUntil
        ? expired
          ? t("expired", { date: formatDate(m.validUntil) })
          : t("validUntil", { date: formatDate(m.validUntil) })
        : t("unlimited");

  const status = self
    ? null
    : m.lastSignInAt
      ? t("joinedAt", { date: formatDate(m.lastSignInAt) })
      : m.credentialsSentAt
        ? m.credentialsSentCount > 1
          ? t("sentAndReminded", {
              date: formatDate(m.credentialsSentAt),
              count: m.credentialsSentCount - 1,
            })
          : t("sentOn", { date: formatDate(m.credentialsSentAt) })
        : t("notSent");

  function onRemind() {
    startTransition(async () => {
      const result = await reissueCredentials({ boatId, userId: m.userId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      if (result.data.emailFailed) toast.warning(t("credentials.emailFailedTitle"));
      else toast.success(t("credentials.sent", { email: result.data.email }));
      router.refresh();
    });
  }

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-medium", expired && "text-ink-3")}>
          {m.fullName ?? m.email}
          {self ? <span className="ml-2 text-sm text-muted-foreground">{t("you")}</span> : null}
        </p>
        {m.fullName ? <p className="truncate text-sm text-muted-foreground">{m.email}</p> : null}
        {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant="secondary">{t(`roles.${m.role}`)}</Badge>
        {access ? (
          <span
            className={cn(
              "text-xs whitespace-nowrap",
              expired ? "font-medium text-state-soon-fg" : "text-muted-foreground",
            )}
          >
            {access}
          </span>
        ) : null}
      </div>
      {editable ? <ChevronRightIcon className="size-5 shrink-0 text-n-400" aria-hidden /> : null}
    </>
  );

  return (
    <li className={cn("flex items-center gap-2 pr-2", expired && "bg-surface-2")}>
      {editable ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("details.open", { name: m.fullName ?? m.email })}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl tap-feedback p-4 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-h-16 min-w-0 flex-1 items-center gap-3 p-4">{body}</div>
      )}
      {editable && waiting ? (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onRemind}>
          <SendIcon />
          {t("remind")}
        </Button>
      ) : null}
    </li>
  );
}
