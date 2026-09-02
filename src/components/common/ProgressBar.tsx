import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

// Category progress: ratio in [0, 1] or null (« — » when the category has no active item).
// 10 px tall: 6 px of bar disappears in full sun (art-direction §7.1).
// The percentage is ALWAYS written next to it — a bar alone carries colour only
// and « empty » is indistinguishable from « 0 % » (ux-flows §6.5).
export function ProgressBar({
  ratio,
  color,
  label,
  showValue = true,
  className,
}: {
  ratio: number | null | undefined;
  color?: string;
  label?: string;
  showValue?: boolean;
  className?: string;
}) {
  const unknown = ratio === null || ratio === undefined || !Number.isFinite(ratio);
  const value = unknown ? 0 : Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  const text = formatPercent(unknown ? null : ratio);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {unknown ? (
        // Hatched track: « no active item », visually distinct from a 0 % bar.
        <div
          role="img"
          aria-label={label ? `${label} — ${text}` : text}
          className="h-2.5 w-full rounded-full border border-border bg-n-100 bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--color-n-300)_4px_8px)]"
        />
      ) : (
        <Progress
          value={value}
          aria-label={label}
          className="h-2.5 bg-n-100"
          indicatorStyle={color ? { backgroundColor: color } : undefined}
        />
      )}
      {showValue ? (
        <span className="w-14 shrink-0 text-right num text-num-sm font-medium text-ink-2">
          {text}
        </span>
      ) : null}
    </div>
  );
}
