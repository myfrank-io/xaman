"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRoundIcon, Trash2Icon } from "lucide-react";

import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MemberRow } from "@/components/members/MembersList";
import { reissueCredentials, removeMember, updateMember } from "@/lib/actions/members";
import { addDays, toIsoDate } from "@/lib/numbers";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { updateMemberSchema, type UpdateMemberInput } from "@/lib/schemas/members";

function splitName(fullName: string | null): { firstName: string; lastName: string } {
  const name = (fullName ?? "").trim();
  const space = name.indexOf(" ");
  if (space < 0) return { firstName: name, lastName: "" };
  return { firstName: name.slice(0, space), lastName: name.slice(space + 1) };
}

/** D154: an owner's card for one member — name, role, end of access, and the two gestures. */
export function MemberDetailsDialog({
  boatId,
  member,
  onOpenChange,
}: {
  boatId: string;
  member: MemberRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {member ? (
          <MemberDetailsForm
            key={member.userId}
            boatId={boatId}
            member={member}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MemberDetailsForm({
  boatId,
  member,
  onDone,
}: {
  boatId: string;
  member: MemberRow;
  onDone: () => void;
}) {
  const t = useTranslations("members");
  const te = useTranslations();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const form = useForm<UpdateMemberInput>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      boatId,
      userId: member.userId,
      ...splitName(member.fullName),
      role: member.role === "renter" ? "viewer" : member.role,
      validUntil: member.validUntil,
    },
  });
  const role = useWatch({ control: form.control, name: "role" });
  const validUntil = useWatch({ control: form.control, name: "validUntil" });

  function onSubmit(values: UpdateMemberInput) {
    startTransition(async () => {
      const result = await updateMember(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("details.saved"));
      router.refresh();
      onDone();
    });
  }

  function onReissue() {
    startTransition(async () => {
      const result = await reissueCredentials({ boatId, userId: member.userId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      if (result.data.emailFailed) toast.warning(t("credentials.emailFailedTitle"));
      else toast.success(t("credentials.sent", { email: result.data.email }));
      router.refresh();
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await removeMember({ boatId, userId: member.userId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("removed"));
      router.refresh();
      onDone();
    });
  }

  if (confirmRemove) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {t("removeDialog.title", { name: member.fullName ?? member.email })}
          </DialogTitle>
          <DialogDescription>{t("removeDialog.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmRemove(false)}>
            {te("common.cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onRemove}>
            {pending ? <Spinner /> : null}
            {t("remove")}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>{member.fullName ?? member.email}</DialogTitle>
        <DialogDescription>{member.email}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="member-first-name" label={t("details.firstName")}>
          <Input id="member-first-name" autoComplete="off" {...form.register("firstName")} />
        </Field>
        <Field id="member-last-name" label={t("details.lastName")}>
          <Input id="member-last-name" autoComplete="off" {...form.register("lastName")} />
        </Field>
      </div>

      <Field id="member-role" label={t("roleLabel")} help={t(`roleHelp.${role}`)}>
        <NativeSelect id="member-role" {...form.register("role")}>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {role === "owner" ? null : (
        <Controller
          control={form.control}
          name="validUntil"
          render={({ field }) => (
            <Field id="member-access" label={t("details.access")} group>
              <div className="flex flex-col gap-3">
                <ToggleGroup
                  type="single"
                  aria-labelledby="member-access-label"
                  value={field.value === null ? "unlimited" : "dated"}
                  onValueChange={(next) => {
                    if (next === "unlimited") field.onChange(null);
                    else if (next === "dated")
                      field.onChange(field.value ?? addDays(toIsoDate(), 30));
                  }}
                >
                  <ToggleGroupItem value="unlimited">{t("unlimited")}</ToggleGroupItem>
                  <ToggleGroupItem value="dated">{t("details.until")}</ToggleGroupItem>
                </ToggleGroup>
                {validUntil !== null ? (
                  <DateField
                    id="member-access-date"
                    future
                    value={validUntil}
                    onValueChange={(value) => field.onChange(value)}
                  />
                ) : null}
              </div>
            </Field>
          )}
        />
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button type="button" variant="outline" disabled={pending} onClick={onReissue}>
          <KeyRoundIcon />
          {t("credentials.reissue")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() => setConfirmRemove(true)}
        >
          <Trash2Icon />
          {t("remove")}
        </Button>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {te("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {t("details.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
