import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Category progress bar: ratio in [0, 1] or null (« — » when the category has no active item).
export function ProgressBar({
  ratio,
  color,
  className,
}: {
  ratio: number | null | undefined;
  color?: string;
  className?: string;
}) {
  const value =
    ratio === null || ratio === undefined ? 0 : Math.round(Math.max(0, Math.min(1, ratio)) * 100);

  return (
    <Progress
      value={value}
      className={cn("bg-muted", className)}
      indicatorStyle={color ? { backgroundColor: color } : undefined}
    />
  );
}
