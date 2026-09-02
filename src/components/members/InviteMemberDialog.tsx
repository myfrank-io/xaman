"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CopyIcon, Share2Icon, UserPlusIcon } from "lucide-react";

import { Field } from "@/components/forms/Field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { inviteMember } from "@/lib/actions/members";
import { formatDate } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import {
  inviteMemberSchema,
  type AccessDuration,
  type InviteMemberInput,
} from "@/lib/schemas/members";

type Sent = { email: string; url: string; validUntil: string | null };

const DURATIONS: AccessDuration[] = ["7", "30", "90", "unlimited"];

/**
 * Invitation (E1-5, D28, D29): role, access duration, the guarantee sentence for a `pro`,
 * then the link to copy or share in addition to the e-mail. An editor invites pro/viewer only,
 * always dated (≤ 90 days).
 */
export function InviteMemberDialog({
  boatId,
  boatName,
  inviterRole,
}: {
  boatId: string;
  boatName: string;
  inviterRole: "owner" | "editor";
}) {
  const t = useTranslations("members");
  const te = useTranslations();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [pending, startTransition] = useTransition();
  const editor = inviterRole === "editor";
  const roles = editor ? ASSIGNABLE_ROLES.filter((r) => r !== "editor") : ASSIGNABLE_ROLES;
  const durations = editor ? DURATIONS.filter((d) => d !== "unlimited") : DURATIONS;
  const defaults: InviteMemberInput = {
    boatId,
    email: "",
    role: editor ? "pro" : "editor",
    duration: editor ? "90" : "unlimited",
  };
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: defaults,
  });
  const role = useWatch({ control: form.control, name: "role" });
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function onSubmit(values: InviteMemberInput) {
    startTransition(async () => {
      const result = await inviteMember(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("invite.sent", { email: values.email }));
      setSent({
        email: values.email,
        url: result.data.inviteUrl,
        validUntil: result.data.validUntil,
      });
      form.reset(defaults);
      router.refresh();
    });
  }

  async function copyLink() {
    if (!sent) return;
    try {
      await navigator.clipboard.writeText(sent.url);
      toast.success(t("invite.linkCopied"));
    } catch {
      toast.error(te("errors.unknown"));
    }
  }

  async function share() {
    if (!sent) return;
    try {
      await navigator.share({
        title: t("invite.title"),
        text: t("invite.shareText", { boat: boatName }),
        url: sent.url,
      });
    } catch {
      // cancelled by the user
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSent(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon />
          {t("invite.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {sent ? (
          <div className="flex flex-col gap-5">
            <DialogHeader>
              <DialogTitle>{t("invite.sentTitle")}</DialogTitle>
              <DialogDescription>
                {t("invite.sentDescription", { email: sent.email })}
                {sent.validUntil
                  ? ` ${t("invite.validUntil", { date: formatDate(sent.validUntil) })}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <Input
              readOnly
              value={sent.url}
              onFocus={(event) => event.target.select()}
              className="num"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={copyLink}>
                <CopyIcon />
                {t("invite.copyLink")}
              </Button>
              {canShare ? (
                <Button type="button" variant="outline" onClick={share}>
                  <Share2Icon />
                  {t("invite.share")}
                </Button>
              ) : null}
              <DialogClose asChild>
                <Button type="button">{te("common.close")}</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            <DialogHeader>
              <DialogTitle>{t("invite.title")}</DialogTitle>
              <DialogDescription>{t("invite.description")}</DialogDescription>
            </DialogHeader>
            <Field
              id="invite-email"
              label={t("invite.email")}
              required
              error={form.formState.errors.email ? te("auth.email.invalid") : undefined}
            >
              <Input
                id="invite-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                enterKeyHint="next"
                aria-invalid={form.formState.errors.email ? true : undefined}
                {...form.register("email")}
              />
            </Field>
            <Field id="invite-role" label={t("roleLabel")} help={t(`roleHelp.${role}`)}>
              <NativeSelect id="invite-role" {...form.register("role")}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Controller
              control={form.control}
              name="duration"
              render={({ field }) => (
                <Field
                  id="invite-duration"
                  label={t("invite.duration")}
                  help={editor ? t("invite.durationHelpEditor") : t("invite.durationHelp")}
                >
                  <ToggleGroup
                    type="single"
                    value={field.value}
                    aria-label={t("invite.duration")}
                    className="flex-wrap justify-start"
                    onValueChange={(next) => {
                      if (next) field.onChange(next);
                    }}
                  >
                    {durations.map((d) => (
                      <ToggleGroupItem key={d} value={d} className="min-h-11">
                        {t(`invite.durations.${d}`)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
              )}
            />
            {role === "pro" ? (
              <Alert variant="info">
                <AlertTitle>{t("invite.proTitle")}</AlertTitle>
                <AlertDescription>{t("invite.proDescription")}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {te("common.cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending} aria-busy={pending}>
                {pending ? <Spinner /> : <UserPlusIcon />}
                {t("invite.submit")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
