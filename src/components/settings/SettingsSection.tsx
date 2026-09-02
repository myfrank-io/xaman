import { cn } from "@/lib/utils";

// One settings block: title, one-sentence purpose, then its content or a « soon » note
// (no dead button: a feature not yet delivered has no control at all).
export function SettingsSection({
  title,
  description,
  soon,
  children,
  className,
}: {
  title: string;
  description?: string;
  soon?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div>
        <h2 className="text-h2">{title}</h2>
        {description ? <p className="mt-1 text-body text-ink-2">{description}</p> : null}
      </div>
      {children}
      {soon ? <p className="text-caption text-ink-3">{soon}</p> : null}
    </section>
  );
}
