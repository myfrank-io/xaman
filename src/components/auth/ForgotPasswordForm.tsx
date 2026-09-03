"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, MailCheckIcon, SendIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { publicEnv } from "@/lib/env";
import { emailSchema, type EmailInput } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Asking for a new password.
 *
 * The answer is the same whether the account exists or not: telling a stranger which addresses
 * have an account here is telling them who sails with whom.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const ta = useTranslations("auth");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  async function submit(values: EmailInput) {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${publicEnv.appUrl}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>
          <MailCheckIcon />
          <AlertTitle>{t("sent.title")}</AlertTitle>
          <AlertDescription>{t("sent.description", { email: sentTo })}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="self-start">
          <Link href="/login">
            <ArrowLeftIcon />
            {t("back")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="forgot-email">{ta("email.label")}</Label>
        <Input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={ta("email.placeholder")}
          autoFocus
          aria-invalid={form.formState.errors.email ? true : undefined}
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-destructive">{ta("email.invalid")}</p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? <Spinner /> : <SendIcon />}
        {t("submit")}
      </Button>
      <Button asChild variant="ghost" className="self-start">
        <Link href="/login">
          <ArrowLeftIcon />
          {t("back")}
        </Link>
      </Button>
    </form>
  );
}
