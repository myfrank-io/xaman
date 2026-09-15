import type { ReactNode } from "react";

/**
 * One page of the builders' brochure (E19-10, D137).
 *
 * The deck handed over as a PDF is seven 16:9 pages, and its grammar never changes: a brass
 * eyebrow, a title set in the display face, a body, and — on the pages that argue rather than
 * open or close — a navy band that says the one sentence to remember. This component is that
 * grammar, so the seven pages of `/constructeurs/brochure` differ only by their body.
 *
 * Two tones, exactly as in the deck: `navy` opens and closes (pages 1, 4 and 7), `paper` carries
 * the argument. A page is at least a screen tall so it reads as a page rather than a section,
 * never *exactly* a screen: a body that outgrows the viewport — which is what happens at
 * 768 × 1024 on page 3 — scrolls on rather than being cut off.
 */
export type BrochureTone = "navy" | "paper";

export function BrochureSlide({
  index,
  total,
  tone,
  eyebrow,
  title,
  level = 2,
  source,
  note,
  children,
}: {
  index: number;
  total: number;
  tone: BrochureTone;
  eyebrow: string;
  /** The cover carries the page's `h1`; the six that follow are `h2`. */
  title: ReactNode;
  level?: 1 | 2;
  source: string;
  /** The navy band at the foot of an argument page. */
  note?: ReactNode;
  children: ReactNode;
}) {
  const navy = tone === "navy";
  const Heading = level === 1 ? "h1" : "h2";

  return (
    <section
      id={`page-${index}`}
      aria-label={`${index} / ${total}`}
      // The bar at the top is sticky and 61 px tall, so a page whose top lands at y = 0 lands its
      // eyebrow underneath it: `scroll-mt-16` is what the rail's links and the `#page-n` anchors
      // aim at instead. The height follows — a page fills the viewport *under* the bar, not the
      // viewport, or the 64 px it was pushed down by would push its footer under the rail.
      className={`brochure-page flex min-h-[calc(100dvh-4rem)] scroll-mt-16 break-after-page flex-col print:min-h-0 ${
        navy ? "bg-header-gradient text-on-navy" : "border-y border-border bg-background"
      }`}
    >
      {/* `pb-24` is the rail's clearance: it floats at the bottom of the viewport, so without it
          the last line of a page — the navy band of page 3 — reads through a row of buttons. */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pt-10 pb-24 lg:px-10 lg:pt-12 print:pb-10">
        <header className="flex flex-col gap-3">
          <p className={`text-overline uppercase ${navy ? "text-brass-light" : "text-brass"}`}>
            {eyebrow}
          </p>
          {/* The short gilt rule the deck draws under the eyebrow of its dark pages. */}
          {navy ? <span aria-hidden className="h-px w-24 bg-brass-light/70" /> : null}
          <Heading
            className={`max-w-4xl font-display text-[1.75rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-[2.25rem] lg:text-[2.75rem] ${
              navy ? "text-on-navy" : "text-foreground"
            }`}
          >
            {title}
          </Heading>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-6">{children}</div>

        {note}

        <footer
          className={`flex items-center justify-between gap-4 border-t pt-4 text-caption ${
            navy ? "border-on-navy-border text-on-navy-3" : "border-border text-ink-3"
          }`}
        >
          <span>{source}</span>
          <span className="num">
            {index} / {total}
          </span>
        </footer>
      </div>
    </section>
  );
}
