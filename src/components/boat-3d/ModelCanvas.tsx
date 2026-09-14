"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  TriangleAlertIcon,
  ClockIcon,
} from "lucide-react";

import { useReducedMotion } from "@/components/common/use-reduced-motion";
import { ZONE_LABELS } from "@/components/boat-3d/zone-labels";
import { buildRamp, drawScene, type Ramp } from "@/lib/boat-3d/renderer";
import { fitCamera, Projector, type BoatMesh, type Camera, type Fit } from "@/lib/boat-3d/scene";
import type { ZoneSummary } from "@/lib/boat-3d/summary";
import type { ZoneKey } from "@/lib/boat-3d/zones";
import { cn } from "@/lib/utils";

/** A quarter turn in seven seconds: fast enough to read as alive, slow enough to tap. */
const SPIN = 0.22;
/** How long the boat waits after a touch before it starts turning again, in milliseconds. */
const IDLE = 2600;
/** Eye elevation: high enough to show the deck, low enough to keep the rig in the frame. */
const PITCH = 0.4;
/** A drag beyond this many pixels is a turn, not a tap. */
const DRAG_SLOP = 8;
/** Half a pin's chip, plus a hair: how close to the edge one is allowed to sit. */
const PIN_EDGE = 16;

export function ModelCanvas({
  mesh,
  zones,
  selected,
  onSelect,
  boatName,
  caption,
  className,
}: {
  mesh: BoatMesh;
  zones: readonly ZoneSummary[];
  selected: ZoneKey | null;
  onSelect: (zone: ZoneKey | null) => void;
  boatName: string;
  /** What the drawing owes to the carnet, in one line under it. */
  caption: string;
  className?: string;
}) {
  const t = useTranslations("boat3d");
  const reducedMotion = useReducedMotion();
  const [spinning, setSpinning] = React.useState(true);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // The pins that are on screen right now, by zone: the loop writes to them directly, and a
  // zone that stops being pinned removes itself here rather than leaving a hole in an array.
  const pinsRef = React.useRef(new Map<ZoneKey, HTMLButtonElement>());

  // Everything the animation loop reads lives in a ref: a frame must never re-render React.
  const stateRef = React.useRef({
    yaw: 0.75,
    target: null as number | null,
    idleUntil: 0,
    spinning: true,
    selected: null as ZoneKey | null,
    size: { width: 0, height: 0, dpr: 1 },
    ramp: null as Ramp | null,
    /** false while the card is scrolled away or the tab is in the background. */
    visible: true,
    /** Set by anything that changes the picture without moving the boat. */
    needsDraw: true,
  });

  // The pins only exist for what is late or due soon — plus whatever is selected. A pin on every
  // zone at once would bury the two that matter under eleven that do not.
  const pinned = React.useMemo(
    () => zones.filter((zone) => zone.overdue > 0 || zone.soon > 0 || zone.key === selected),
    [zones, selected],
  );

  const projector = React.useMemo(() => new Projector(mesh), [mesh]);
  /** Where each zone's pin is planted, looked up once rather than searched every frame. */
  const anchors = React.useMemo(
    () => new Map(mesh.parts.map((part) => [part.zone, part.anchor])),
    [mesh],
  );
  // The framing costs a full turn of the mesh, so it is computed on resize and never in render.
  const fitRef = React.useRef<Fit | null>(null);

  React.useEffect(() => {
    stateRef.current.spinning = spinning && !reducedMotion;
    stateRef.current.needsDraw = true;
  }, [spinning, reducedMotion]);

  React.useEffect(() => {
    stateRef.current.selected = selected;
    stateRef.current.needsDraw = true;
  }, [selected]);

  /** Turns the boat so the tapped zone comes round to face the eye. */
  const faceZone = React.useCallback(
    (zone: ZoneKey | null) => {
      const anchor = zone ? anchors.get(zone) : undefined;
      if (!anchor) return;
      const [x, , z] = anchor;
      // Bring the anchor to the front quarter rather than dead centre: a three-quarter view is
      // what makes a shape readable, and it keeps the rest of the boat in the picture.
      stateRef.current.target = -Math.atan2(x, z) + 0.55;
    },
    [anchors],
  );

  const select = React.useCallback(
    (zone: ZoneKey | null) => {
      onSelect(zone);
      faceZone(zone);
      stateRef.current.idleUntil = performance.now() + IDLE;
    },
    [faceZone, onSelect],
  );

  /* ---- size, palette ------------------------------------------------------------------- */
  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const readPalette = () => {
      const style = getComputedStyle(canvas);
      stateRef.current.ramp = buildRamp({
        hull: style.getPropertyValue("--model-hull"),
        light: style.getPropertyValue("--model-light"),
        sea: style.getPropertyValue("--model-sea"),
        pick: style.getPropertyValue("--model-pick"),
      });
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      stateRef.current.size = { width, height, dpr };
      stateRef.current.needsDraw = true;
      fitRef.current = fitCamera(mesh, { pitch: PITCH, width, height, fill: 0.92 });
      readPalette();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    // A boat turning below the fold is a boat nobody is looking at: on an iPad that is battery
    // and nothing else. Same for a tab left in the background.
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) stateRef.current.visible = entry.isIntersecting;
        stateRef.current.needsDraw = true;
      },
      { threshold: 0 },
    );
    seen.observe(container);
    const onVisibility = () => {
      stateRef.current.needsDraw = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    // The palette follows the theme, which is a class on the document element.
    const theme = new MutationObserver(readPalette);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      seen.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mesh]);

  /* ---- the loop ------------------------------------------------------------------------ */
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let frame = 0;
    let previous = performance.now();

    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const state = stateRef.current;
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (!state.visible || document.hidden) return;

      let moved = false;
      if (state.target !== null) {
        const delta = shortestAngle(state.yaw, state.target);
        state.yaw += delta * Math.min(1, dt * 6);
        moved = true;
        if (Math.abs(delta) < 0.01) {
          state.yaw = state.target;
          state.target = null;
          state.idleUntil = now + IDLE;
        }
      } else if (state.spinning && now >= state.idleUntil) {
        state.yaw += SPIN * dt;
        moved = true;
      }
      // Paused, and nothing else changed: the cheapest frame is the one that is not drawn.
      if (!moved && !state.needsDraw) return;
      state.needsDraw = false;

      const { width, height, dpr } = state.size;
      const fit = fitRef.current;
      if (width < 2 || height < 2 || !state.ramp || !fit) return;
      const camera: Camera = { yaw: state.yaw, pitch: PITCH, width, height, fit };
      projector.run(camera);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, mesh, projector, camera, {
        ramp: state.ramp,
        selected: partOf(mesh, state.selected),
      });

      // The pins ride along, one DOM write each: a React render per frame would cost more than
      // the whole of the drawing above.
      const eye = mesh.radius * 3.4;
      for (const [zone, element] of pinsRef.current) {
        const anchor = anchors.get(zone);
        if (!anchor) continue;
        const point = projector.projectPoint(anchor, camera);
        const behind = point.depth > eye;
        // Kept inside the frame: a zone whose anchor swings past the edge would have its pin
        // cut in half by the rounded box, and a half pin is not a 44 px target.
        const x = Math.min(Math.max(point.x, PIN_EDGE), width - PIN_EDGE);
        const y = Math.min(Math.max(point.y, PIN_EDGE), height - PIN_EDGE);
        element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        element.style.opacity = behind ? "0.32" : "1";
        element.style.pointerEvents = behind ? "none" : "auto";
      }
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [anchors, mesh, projector]);

  /* ---- pointer: drag to turn, tap to choose -------------------------------------------- */
  const dragRef = React.useRef({ active: false, startX: 0, lastX: 0, moved: 0 });

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, startX: event.clientX, lastX: event.clientX, moved: 0 };
    stateRef.current.target = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const dx = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    drag.moved += Math.abs(dx);
    // A full width of the canvas is a bit more than half a turn: the boat follows the finger.
    stateRef.current.yaw -= (dx / Math.max(stateRef.current.size.width, 1)) * Math.PI * 1.6;
    stateRef.current.idleUntil = performance.now() + IDLE;
    stateRef.current.needsDraw = true;
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    drag.active = false;
    stateRef.current.idleUntil = performance.now() + IDLE;
    if (drag.moved > DRAG_SLOP) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const face = projector.hit(event.clientX - rect.left, event.clientY - rect.top);
    const part = face === null ? undefined : mesh.faces[face]?.part;
    const zone = part === undefined ? null : (mesh.parts[part]?.zone ?? null);
    // Tapping the water clears the choice — the way stepping back from a boat does.
    select(zone !== null && zone === selected ? null : zone);
  };

  const nudge = (direction: 1 | -1) => {
    stateRef.current.target = stateRef.current.yaw + (direction * Math.PI) / 4;
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        ref={containerRef}
        // A rigged boat is a portrait subject: it is three times as tall as it is long, so the
        // frame is made tall where there is room for it. In one column the box is wide and the
        // boat fills its height; beside the list it goes portrait, and the boat doubles.
        className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-sunken lg:aspect-[3/4]"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t("canvasLabel", { name: boatName })}
          // Horizontal drags turn the boat; vertical ones stay the page's, so a full-width
          // model never traps the scroll on an iPad.
          className="absolute inset-0 touch-pan-y"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current.active = false;
          }}
        />
        {pinned.map((zone) => (
          <ZonePin
            key={zone.key}
            zone={zone}
            label={zone.name ?? t(ZONE_LABELS[zone.labelKey ?? "hulls"])}
            active={zone.key === selected}
            onSelect={() => select(zone.key === selected ? null : zone.key)}
            ref={(element) => {
              if (element) pinsRef.current.set(zone.key, element);
              else pinsRef.current.delete(zone.key);
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-caption text-ink-3">{t("hint")}</p>
        <div className="flex shrink-0 items-center">
          <ControlButton label={t("turnPort")} onClick={() => nudge(-1)}>
            <ChevronLeftIcon aria-hidden />
          </ControlButton>
          {reducedMotion ? null : (
            <ControlButton
              label={spinning ? t("pause") : t("play")}
              onClick={() => setSpinning((on) => !on)}
            >
              {spinning ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
            </ControlButton>
          )}
          <ControlButton label={t("turnStarboard")} onClick={() => nudge(1)}>
            <ChevronRightIcon aria-hidden />
          </ControlButton>
        </div>
      </div>

      {/* Right under the drawing, where it answers the question the drawing raises: « why does
          it look like that? ». Because that is what the carnet says the boat carries. */}
      <p className="text-caption text-ink-3">{caption}</p>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-lg tap-feedback text-ink-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&>svg]:size-5"
    >
      {children}
    </button>
  );
}

const ZonePin = React.forwardRef<
  HTMLButtonElement,
  {
    zone: ZoneSummary;
    label: string;
    active: boolean;
    onSelect: () => void;
  }
>(function ZonePin({ zone, label, active, onSelect }, ref) {
  const t = useTranslations("boat3d");
  const overdue = zone.overdue > 0;
  const count = overdue ? zone.overdue : zone.soon;
  const Icon = overdue ? TriangleAlertIcon : ClockIcon;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={t(overdue ? "pinOverdue" : count > 0 ? "pinSoon" : "pinPlain", {
        zone: label,
        count,
      })}
      // 44 px of target around a 26 px chip: the chip is what is seen, the padding is what is hit.
      className="absolute top-0 left-0 flex size-11 items-center justify-center will-change-transform"
      style={{ transform: "translate3d(-100px, -100px, 0)" }}
    >
      <span
        className={cn(
          "inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full border px-1 num text-xs font-bold shadow-sm",
          overdue
            ? "border-state-overdue-border bg-state-overdue-tint text-state-overdue-fg"
            : count > 0
              ? "border-state-soon-border bg-state-soon-tint text-state-soon-fg"
              : "border-border-strong bg-surface text-ink-2",
          active && "ring-[3px] ring-ring/60",
        )}
      >
        {count > 0 ? (
          <>
            <Icon className="size-3" aria-hidden />
            {count}
          </>
        ) : (
          <span className="size-2 rounded-full bg-ink-3" aria-hidden />
        )}
      </span>
    </button>
  );
});

function partOf(mesh: BoatMesh, zone: ZoneKey | null): number | null {
  if (!zone) return null;
  const index = mesh.parts.findIndex((part) => part.zone === zone);
  return index < 0 ? null : index;
}

/** The shorter way round from one angle to another: turning 350° to the right is turning 10° left. */
function shortestAngle(from: number, to: number): number {
  const delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
}
