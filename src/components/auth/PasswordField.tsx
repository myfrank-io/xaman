"use client";

import { useId, useState, type ComponentProps } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A password field with the reveal button every phone keyboard now expects.
 *
 * On an iPad the password is typed with a thumb on a glass keyboard and mistyped often; hiding
 * it with no way to look is how people give up. The button is a real 44 px target inside the
 * field, and it never submits the form.
 */
export function PasswordField({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const t = useTranslations("auth.password");
  const [visible, setVisible] = useState(false);
  const describedBy = useId();

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
        aria-describedby={props["aria-describedby"] ?? describedBy}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? t("hide") : t("show")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex size-11 items-center justify-center rounded-md text-ink-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {visible ? (
          <EyeOffIcon className="size-5" aria-hidden />
        ) : (
          <EyeIcon className="size-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
