import { LogOutIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export async function SignOutButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const t = await getTranslations("nav");
  return (
    <form action={signOut}>
      <Button type="submit" variant={variant}>
        <LogOutIcon />
        {t("signOut")}
      </Button>
    </form>
  );
}
