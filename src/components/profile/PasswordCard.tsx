"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { CheckIcon, KeyRoundIcon, TriangleAlertIcon } from "lucide-react";

import { PasswordField } from "@/components/auth/PasswordField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { newPasswordSchema, type NewPasswordInput } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Changing your password from your own profile (D45).
 *
 * The recovery link is not the only way in, and on this project it is the fragile one: the
 * e-mail it needs goes through the mailbox of the whole application, which has an hourly
 * quota. Someone already signed in never needed that detour — they are authenticated, so the
 * new password can be written straight away, and no message has to arrive anywhere.
 *
 * Supabase keeps the current device signed in and revokes the others, which is what changing
 * a password is for; the help text says so rather than letting it surprise anyone.
 */
export function PasswordCard() {
  const t = useTranslations("profile.password");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function submit(values: NewPasswordInput) {
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
    if (updateError) {
      const message = updateError.message;
      // Supabase refuses a password identical to the current one: that is not a failure to
      // retry, it is an answer, and saying which one saves the next attempt.
      if (/should be different|same.*password/i.test(message)) setError(t("sameAsOld"));
      else if (/password/i.test(message)) setError(t("weak"));
      else setError(t("failed"));
      return;
    }
    form.reset({ password: "", confirm: "" });
    setSaved(true);
  }

  const errors = form.formState.errors;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3">{t("title")}</h2>
        <p className="text-caption text-ink-2">{t("help")}</p>
      </div>

      {saved ? (
        <Alert>
          <CheckIcon />
          <AlertTitle>{t("saved")}</AlertTitle>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="profile-password">{t("new")}</Label>
          <PasswordField
            id="profile-password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            {...form.register("password")}
          />
          {errors.password ? <p className="text-sm text-destructive">{t("weak")}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-password-confirm">{t("confirm")}</Label>
          <PasswordField
            id="profile-password-confirm"
            autoComplete="new-password"
            aria-invalid={errors.confirm ? true : undefined}
            {...form.register("confirm")}
          />
          {errors.confirm ? (
            <AlertDescription className="text-sm text-destructive">
              {t("mismatch")}
            </AlertDescription>
          ) : null}
        </div>
        <Button
          type="submit"
          size="lg"
          className="self-start"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? <Spinner /> : <KeyRoundIcon />}
          {t("submit")}
        </Button>
      </form>
    </section>
  );
}
