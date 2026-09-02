"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { updateProfile } from "@/lib/actions/profile";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/schemas/profile";

export function ProfileForm({ defaultValues }: { defaultValues: UpdateProfileInput }) {
  const t = useTranslations("profile");
  const te = useTranslations();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues,
  });

  function onSubmit(values: UpdateProfileInput) {
    startTransition(async () => {
      const result = await updateProfile(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("identity")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="fullName">{t("fullName")}</Label>
            <Input
              id="fullName"
              autoComplete="name"
              aria-invalid={form.formState.errors.fullName ? true : undefined}
              {...form.register("fullName")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="locale">{t("locale")}</Label>
            <NativeSelect id="locale" {...form.register("locale")}>
              <option value="fr">{t("locales.fr")}</option>
            </NativeSelect>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : null}
              {te("common.save")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
