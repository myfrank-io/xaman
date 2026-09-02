"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserPlusIcon } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { inviteMember } from "@/lib/actions/members";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/schemas/members";

export function InviteMemberDialog({ boatId }: { boatId: string }) {
  const t = useTranslations("members");
  const te = useTranslations();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { boatId, email: "", role: "editor" },
  });
  const role = useWatch({ control: form.control, name: "role" });

  function onSubmit(values: InviteMemberInput) {
    startTransition(async () => {
      const result = await inviteMember(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("invite.sent", { email: values.email }));
      form.reset({ boatId, email: "", role: "editor" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon />
          {t("invite.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>{t("invite.title")}</DialogTitle>
            <DialogDescription>{t("invite.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="invite-email">{t("invite.email")}</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              aria-invalid={form.formState.errors.email ? true : undefined}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{te("auth.email.invalid")}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-role">{t("roleLabel")}</Label>
            <NativeSelect id="invite-role" {...form.register("role")}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`roles.${r}`)}
                </option>
              ))}
            </NativeSelect>
            <p className="text-sm text-muted-foreground">{t(`roleHelp.${role}`)}</p>
          </div>
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
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : <UserPlusIcon />}
              {t("invite.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
