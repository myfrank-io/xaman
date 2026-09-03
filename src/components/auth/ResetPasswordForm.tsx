"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";

import { PasswordField } from "@/components/auth/PasswordField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { newPasswordSchema, type NewPasswordInput } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Choosing a new password after following the recovery link.
 *
 * Reaching this screen only works with the session the link opened; without it the form is not
 * even shown, because a « save » that silently does nothing is worse than a refusal.
 */
export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "expired">("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setReady(data.session ? "ok" : "expired");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function submit(values: NewPasswordInput) {
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
    if (updateError) {
      setError(/password/i.test(updateError.message) ? t("errors.weak") : t("errors.failed"));
      return;
    }
    startTransition(() => {
      router.replace("/boats");
      router.refresh();
    });
  }

  if (ready === "checking") {
    return (
      <p className="flex items-center gap-2 text-body text-ink-2">
        <Spinner className="size-4" />
      </p>
    );
  }

  if (ready === "expired") {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{t("expired.title")}</AlertTitle>
          <AlertDescription>{t("expired.description")}</AlertDescription>
        </Alert>
        <Button asChild size="lg" className="self-start">
          <Link href="/forgot-password">{t("expired.action")}</Link>
        </Button>
      </div>
    );
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5" noValidate>
      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="new-password">{t("password")}</Label>
        <PasswordField
          id="new-password"
          autoComplete="new-password"
          autoFocus
          aria-invalid={errors.password ? true : undefined}
          {...form.register("password")}
        />
        {errors.password ? <p className="text-sm text-destructive">{t("errors.weak")}</p> : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-confirm">{t("confirm")}</Label>
        <PasswordField
          id="new-confirm"
          autoComplete="new-password"
          aria-invalid={errors.confirm ? true : undefined}
          {...form.register("confirm")}
        />
        {errors.confirm ? <p className="text-sm text-destructive">{t("errors.weak")}</p> : null}
      </div>
      <Button type="submit" size="xl" disabled={form.formState.isSubmitting || pending}>
        {form.formState.isSubmitting || pending ? <Spinner /> : <CheckIcon />}
        {t("submit")}
      </Button>
    </form>
  );
}
