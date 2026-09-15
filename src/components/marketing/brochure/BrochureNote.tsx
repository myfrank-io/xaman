import type { ReactNode } from "react";

/**
 * The navy band that closes an argument page of the brochure (E19-10).
 *
 * In the deck it is the sentence a reader keeps after the page has scrolled by — « Vous avez
 * déjà le réseau. Il manque le carnet qui le relie. » It is deliberately the only element on a
 * paper page that inverts: the eye lands there last, and stays.
 */
export function BrochureNote({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <aside className="flex items-start gap-4 rounded-xl bg-navy px-5 py-5 text-on-navy shadow-sm lg:px-6">
      {icon ? (
        <span aria-hidden className="mt-0.5 shrink-0 text-brass-light">
          {icon}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-h2 text-on-navy">{title}</p>
        {children}
      </div>
    </aside>
  );
}
