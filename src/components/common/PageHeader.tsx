import * as React from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  /**
   * Explanatory prose under the title. **Hidden on a phone**: it is written for someone
   * meeting the screen for the first time, and it is paid on every visit for ever. « Ce qui
   * doit être fait, et quand. Cocher un point écrit l'intervention. » is two lines of a screen
   * with about seven to give, measured — the header goes from 132 px to 44 px without it.
   */
  subtitle?: React.ReactNode;
  /**
   * Overrides that rule, for the screens whose subtitle slot carries live data rather than
   * prose — the interventions list puts « 12 résultats » there once a filter is on, and a
   * count is feedback, not onboarding. Pass `"block"`.
   */
  subtitleClassName?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  subtitleClassName,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? (
          <p
            className={cn("mt-1 hidden text-sm text-muted-foreground sm:block", subtitleClassName)}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
