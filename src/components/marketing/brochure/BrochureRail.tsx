"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PrinterIcon } from "lucide-react";

/**
 * The way through the seven pages (E19-10, D137).
 *
 * Without scripting the rail is still seven anchors to seven `id`s, which is the whole of what
 * it has to do — a brochure read by scrolling needs no JavaScript. What the script adds is the
 * three things a reader expects of a deck and a document cannot give: the current page is
 * marked, the arrow keys turn it, and the whole thing prints as seven landscape pages.
 *
 * Its words arrive as props rather than through `useTranslations`: this is the only client
 * component of the public site, and passing five strings costs less than a message slice around
 * two marketing pages (D110).
 *
 * The seven numbers do not fit a 320 px screen — nine round targets of 44 px are 396 px before
 * any padding, and the audit forbids a page that scrolls sideways (rule 1). Below `sm` the rail
 * says « 3 / 7 » between the two arrows and the numbers step aside.
 */
export function BrochureRail({
  total,
  label,
  goTo,
  position,
  print,
}: {
  total: number;
  label: string;
  /** « Page {number} », already formatted, one per page. */
  goTo: readonly string[];
  /** « Page {number} sur {total} », already formatted, one per page. */
  position: readonly string[];
  print: string;
}) {
  const [current, setCurrent] = useState(1);

  const go = useCallback(
    (page: number) => {
      const target = Math.min(Math.max(page, 1), total);
      document.getElementById(`page-${target}`)?.scrollIntoView({ behavior: "smooth" });
    },
    [total],
  );

  // Which page is on screen. `scrollIntoView` is smooth, so the mark follows the scroll rather
  // than jumping to the destination the moment a link is tapped.
  useEffect(() => {
    const sections = Array.from({ length: total }, (_, i) =>
      document.getElementById(`page-${i + 1}`),
    ).filter((node): node is HTMLElement => node !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const page = Number(visible.target.id.replace("page-", ""));
        if (Number.isFinite(page)) setCurrent(page);
      },
      // A page is « the one being read » once it owns the middle band of the viewport.
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [total]);

  // Arrow keys turn the page, unless the reader is typing somewhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) {
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        go(current + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(current - 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, go]);

  const pages = Array.from({ length: total }, (_, i) => i + 1);
  const round =
    "inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-brass-light/60";

  return (
    <nav
      aria-label={label}
      className="pointer-events-none sticky bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden"
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 rounded-full border border-on-navy-border bg-navy/95 px-1.5 py-1.5 text-on-navy shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => go(current - 1)}
          disabled={current === 1}
          aria-label={position[Math.max(current - 2, 0)]}
          className={`${round} hover:bg-on-navy-surface disabled:opacity-35`}
        >
          <ChevronLeftIcon className="size-5" aria-hidden />
        </button>

        {/* Narrow: where the reader is. Wide: where they can go. */}
        <p aria-live="polite" className="px-3 text-label whitespace-nowrap tabular-nums sm:hidden">
          {current} / {total}
        </p>
        <ol className="hidden items-center gap-0.5 sm:flex">
          {pages.map((page) => (
            <li key={page}>
              <a
                href={`#page-${page}`}
                aria-label={goTo[page - 1]}
                aria-current={page === current ? "true" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  go(page);
                }}
                className={`${round} text-caption tabular-nums ${
                  page === current
                    ? "bg-brass-light font-semibold text-navy"
                    : "text-on-navy-2 hover:bg-on-navy-surface"
                }`}
              >
                {page}
              </a>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => go(current + 1)}
          disabled={current === total}
          aria-label={position[Math.min(current, total - 1)]}
          className={`${round} hover:bg-on-navy-surface disabled:opacity-35`}
        >
          <ChevronRightIcon className="size-5" aria-hidden />
        </button>

        {/* The deck was made to be handed over; the page keeps that. Wide screens only — a
            brochure is not printed from a phone, and the row has no room for a tenth target. */}
        <button
          type="button"
          onClick={() => window.print()}
          aria-label={print}
          className={`${round} ml-1 hidden border-l border-on-navy-border text-on-navy-2 hover:bg-on-navy-surface sm:inline-flex`}
        >
          <PrinterIcon className="size-5" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
