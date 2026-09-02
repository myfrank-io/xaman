import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

// iPhone / iPad portrait: compact top bar (boat name + primary action). Safe-area aware.
export function TopBar({
  boatName,
  action,
  className,
}: {
  boatName: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("app");

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-header-gradient safe-top text-white shadow-md",
        className,
      )}
    >
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-widest text-white/60 uppercase">
            {t("name")}
          </p>
          <p className="truncate text-base font-semibold">{boatName}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
