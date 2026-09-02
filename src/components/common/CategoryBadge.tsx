import { cn } from "@/lib/utils";

// Category colors live in the database (boat_categories.color, hex) → inline styles.
export function CategoryDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

export function CategoryBadge({
  name,
  color,
  archived = false,
  size = "default",
  className,
}: {
  name: string;
  color: string;
  archived?: boolean;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-1.5 rounded-md border font-medium whitespace-nowrap text-foreground",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        archived && "opacity-60",
        className,
      )}
      style={{ backgroundColor: `${color}1f`, borderColor: `${color}55` }}
    >
      <CategoryDot color={color} />
      <span className="truncate">{name}</span>
    </span>
  );
}
