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
        {/* `text-h1` IS the token: it carries the size, the line height, the weight and the
            display face (globals.css @layer base). The hand-rolled `text-xl sm:text-2xl` said
            the same thing twice, one step below the scale, on some thirty screens. */}
        <h1 className="text-h1">{title}</h1>
        {subtitle ? (
          <p className={cn("mt-1 hidden text-body text-ink-2 sm:block", subtitleClassName)}>
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
