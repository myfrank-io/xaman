"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserPlusIcon } from "lucide-react";

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
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { ASSIGNABLE_ROLES, EDITOR_ASSIGNABLE_ROLES } from "@/lib/permissions";
import {
  inviteMemberSchema,
  type AccessDuration,
  type InviteMemberInput,
} from "@/lib/schemas/members";

type Sent = { email: string; emailFailed: boolean };

const DURATIONS: AccessDuration[] = ["7", "30", "90", "unlimited"];

/**
 * Invitation (E1-5, D28, D29, D89, D151): role, access duration, the sentence that says what the
 * role really allows. Since D151 there is no link to copy or share any more — submitting creates
 * the account (or resets its password) and a boat membership on the spot, and sends one e-mail
 * carrying the login e-mail and a fresh password. The dialog only reports whether that e-mail
 * left.
 *
 * Since D89 the list carries `owner` too. It brings its own rule: the duration question
 * disappears, because an owner has no end date (`inviteMember` writes null whatever the form
 * held), and a warning takes its place — the person invited this way can remove the person
 * inviting them.
 */
export function InviteMemberDialog({
  boatId,
  inviterRole,
  defaultEmail = "",
  defaultRole,
  title,
  description,
  trigger,
}: {
  boatId: string;
  inviterRole: "owner" | "editor";
  defaultEmail?: string;
  defaultRole?: InviteMemberInput["role"];
  title?: string;
  description?: string;
  trigger?: ReactNode;
}) {
  const t = useTranslations("members");
  const te = useTranslations();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [pending, startTransition] = useTransition();
  const editor = inviterRole === "editor";
  const roles = editor ? EDITOR_ASSIGNABLE_ROLES : ASSIGNABLE_ROLES;
  const durations = editor ? DURATIONS.filter((d) => d !== "unlimited") : DURATIONS;
  const defaults: InviteMemberInput = {
    boatId,
    email: defaultEmail,
    role: defaultRole ?? (editor ? "pro" : "editor"),
    duration: editor ? "90" : "unlimited",
  };
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: defaults,
  });
  const role = useWatch({ control: form.control, name: "role" });

  function onSubmit(values: InviteMemberInput) {
    startTransition(async () => {
      const result = await inviteMember(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      // The account and the membership exist either way; only the message may have stayed
      // behind (D151).
      if (result.data.emailFailed) toast.warning(t("invite.emailFailedTitle"));
      else toast.success(t("invite.sent", { email: values.email }));
      setSent({ email: values.email, emailFailed: result.data.emailFailed });
      form.reset(defaults);
      router.refresh();
    });
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
        {trigger ?? (
          <Button>
            <UserPlusIcon />
            {t("invite.button")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        {sent ? (
          <div className="flex flex-col gap-5">
            {/* The account and the membership exist in both cases; only the sentence about the
                e-mail changes (D151). Nothing here to copy or share any more: there is no link,
                the credentials went out (or didn't) by e-mail alone. */}
            <DialogHeader>
              <DialogTitle>
                {sent.emailFailed ? t("invite.emailFailedTitle") : t("invite.sentTitle")}
              </DialogTitle>
              <DialogDescription>
                {sent.emailFailed
                  ? t("invite.emailFailed", { email: sent.email })
                  : t("invite.sentDescription", { email: sent.email })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button">{te("common.close")}</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            <DialogHeader>
              <DialogTitle>{title ?? t("invite.title")}</DialogTitle>
              <DialogDescription>{description ?? t("invite.description")}</DialogDescription>
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
            {/* An owner has no end date (D89): the question is removed rather than asked and
                then ignored — the alert below says so in words. */}
            <Controller
              control={form.control}
              name="duration"
              render={({ field }) =>
                role === "owner" ? (
                  <></>
                ) : (
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
                )
              }
            />
            {role === "owner" ? (
              <Alert variant="warning">
                <AlertTitle>{t("invite.ownerTitle")}</AlertTitle>
                <AlertDescription>{t("invite.ownerDescription")}</AlertDescription>
              </Alert>
            ) : null}
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
