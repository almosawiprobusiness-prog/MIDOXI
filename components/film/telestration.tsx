"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ANNOTATION_COLORS,
  DEFAULT_WIDTH,
  MAX_SHAPES,
  TEXT_MAX,
  TOOLS,
  colorCss,
  shapeAt,
  type AnnotationColor,
  type Shape,
  type ToolKind,
} from "@/lib/data/annotation-types";
import { cn } from "@/lib/utils";

/*
  The drawing surface.

  Sits over a paused frame and captures marks in normalised 0..1
  coordinates, so what is drawn on a laptop lands in the same place when
  it is read back on a phone.

  Pointer events rather than mouse or touch: one code path covers a
  mouse, a finger and a stylus, and `setPointerCapture` keeps a stroke
  attached to the surface when the hand leaves the frame mid-drag —
  which is exactly what happens when somebody circles a player at the
  touchline.
*/

/** Resolve a CSS custom property to something canvas can actually paint. */
function resolveColor(css: string, el: HTMLElement): string {
  const m = css.match(/^var\((--[^)]+)\)$/);
  if (!m) return css;
  const v = getComputedStyle(el).getPropertyValue(m[1]).trim();
  return v || "#f4f3f8";
}

export function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  w: number,
  h: number,
  host: HTMLElement,
) {
  const minSide = Math.min(w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const s of shapes) {
    const color = resolveColor(colorCss(s.c), host);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, s.w * minSide);
    ctx.beginPath();

    if (s.t === "pen") {
      for (let i = 0; i < s.pts.length; i += 2) {
        const x = s.pts[i] * w;
        const y = s.pts[i + 1] * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (s.t === "ellipse") {
      ctx.ellipse(s.x * w, s.y * h, s.rx * w, s.ry * h, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.t === "marker") {
      /*
        The broadcast ring: a flattened ellipse at the player's feet,
        drawn twice — a wide soft pass then the crisp one — so it reads
        against both grass and shadow.
      */
      const rx = minSide * 0.045;
      const ry = rx * 0.38;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = Math.max(3, s.w * minSide * 2.2);
      ctx.ellipse(s.x * w, s.y * h, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.lineWidth = Math.max(1.5, s.w * minSide);
      ctx.ellipse(s.x * w, s.y * h, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.t === "text") {
      /*
        A cue, set in the display voice, on a dark backing chip so it
        stays legible over grass, kits and floodlights alike.
      */
      const size = Math.max(14, minSide * 0.042);
      ctx.save();
      ctx.font = `700 ${size}px "Big Shoulders", "Arial Narrow", sans-serif`;
      ctx.textBaseline = "middle";
      const label = s.s.toUpperCase();
      const wPx = ctx.measureText(label).width;
      const padX = size * 0.45;
      const padY = size * 0.32;
      const cx = s.x * w;
      const cy = s.y * h;
      ctx.fillStyle = "rgba(8, 9, 11, 0.78)";
      ctx.fillRect(cx - wPx / 2 - padX, cy - size / 2 - padY, wPx + padX * 2, size + padY * 2);
      ctx.fillStyle = color;
      ctx.fillText(label, cx - wPx / 2, cy + size * 0.06);
      ctx.restore();
    } else {
      const x1 = s.x1 * w, y1 = s.y1 * h, x2 = s.x2 * w, y2 = s.y2 * h;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (s.t === "arrow") {
        /*
          The head is sized from the frame, not from the arrow's own
          length. Scaling it to the line makes a short arrow — the most
          common kind, one player to the space beside him — almost
          headless, so it stops reading as direction.
        */
        const head = Math.max(8, minSide * 0.035);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  }
}

export function Telestration({
  shapes,
  onChange,
  tool,
  color,
  label = "",
  readOnly = false,
}: {
  shapes: Shape[];
  onChange?: (next: Shape[]) => void;
  tool: ToolKind;
  color: AnnotationColor;
  /** The word the text tool stamps. Lives in the tools bar, not here. */
  label?: string;
  readOnly?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  /*
    Repaint on every change, and on resize.

    The canvas is sized to its own client box each time rather than
    kept at a fixed resolution: the player is fluid, and a canvas whose
    backing store does not match its display size draws everything
    blurred and offset.
  */
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    drawShapes(ctx, draft ? [...shapes, draft] : shapes, rect.width, rect.height, wrap);
  }, [shapes, draft]);

  useEffect(() => {
    repaint();
  }, [repaint]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => repaint());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [repaint]);

  const point = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const onDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    const p = point(e);

    // The eraser removes; it never draws, so the shape cap does not apply.
    if (tool === "eraser") {
      const hit = shapeAt(shapes, p.x, p.y);
      if (hit >= 0) onChange?.(shapes.filter((_, i) => i !== hit));
      return;
    }

    if (shapes.length >= MAX_SHAPES) return;

    // Taps, not drags: these land whole on pointer-down.
    if (tool === "marker") {
      onChange?.([...shapes, { t: "marker", c: color, w: DEFAULT_WIDTH, x: p.x, y: p.y }]);
      return;
    }
    if (tool === "text") {
      const s = label.trim().slice(0, TEXT_MAX);
      if (!s) return; // nothing typed in the bar yet — stamping nothing is nothing
      onChange?.([...shapes, { t: "text", c: color, w: DEFAULT_WIDTH, x: p.x, y: p.y, s }]);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = p;
    setDraft(
      tool === "pen"
        ? { t: "pen", c: color, w: DEFAULT_WIDTH, pts: [p.x, p.y] }
        : tool === "arrow" || tool === "line"
          ? { t: tool, c: color, w: DEFAULT_WIDTH, x1: p.x, y1: p.y, x2: p.x, y2: p.y }
          : { t: "ellipse", c: color, w: DEFAULT_WIDTH, x: p.x, y: p.y, rx: 0.001, ry: 0.001 },
    );
  };

  const onMove = (e: React.PointerEvent) => {
    if (readOnly || !draft || !start.current) return;
    const p = point(e);
    const s = start.current;

    setDraft((d) => {
      if (!d) return d;
      if (d.t === "marker" || d.t === "text") return d; // placed whole on down
      if (d.t === "pen") {
        /*
          Skip points closer than half a percent of the frame. A
          pointer fires far faster than a hand moves, and storing every
          event makes a scribble hundreds of points long for no visible
          difference.
        */
        const lastX = d.pts[d.pts.length - 2];
        const lastY = d.pts[d.pts.length - 1];
        if (Math.hypot(p.x - lastX, p.y - lastY) < 0.005) return d;
        return { ...d, pts: [...d.pts, p.x, p.y] };
      }
      if (d.t === "arrow" || d.t === "line") return { ...d, x2: p.x, y2: p.y };
      // Drawn from the corner out, the way a selection box behaves.
      return { ...d, x: (s.x + p.x) / 2, y: (s.y + p.y) / 2, rx: Math.abs(p.x - s.x) / 2, ry: Math.abs(p.y - s.y) / 2 };
    });
  };

  const onUp = () => {
    if (readOnly || !draft) return;
    start.current = null;

    /*
      Drop marks too small to have been meant. A click without a drag
      is how somebody pauses or focuses the frame, and it should not
      leave a dot behind.
    */
    const tooSmall =
      ((draft.t === "arrow" || draft.t === "line") &&
        Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < 0.02) ||
      (draft.t === "ellipse" && (draft.rx < 0.01 || draft.ry < 0.01)) ||
      (draft.t === "pen" && draft.pts.length < 6);

    setDraft(null);
    if (!tooSmall) onChange?.([...shapes, draft]);
  };

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={cn("absolute inset-0", readOnly ? "pointer-events-none" : "cursor-crosshair touch-none")}
      />
    </div>
  );
}

/** The pen/colour bar. Separate so the canvas stays purely about drawing. */
export function TelestrationTools({
  tool,
  setTool,
  color,
  setColor,
  onUndo,
  onRedo,
  canRedo = false,
  onClear,
  count,
  label = "",
  setLabel,
}: {
  tool: ToolKind;
  setTool: (t: ToolKind) => void;
  color: AnnotationColor;
  setColor: (c: AnnotationColor) => void;
  onUndo: () => void;
  onRedo?: () => void;
  canRedo?: boolean;
  onClear: () => void;
  count: number;
  label?: string;
  setLabel?: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            title={t.hint}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
              tool === t.key
                ? "border-signal-line bg-signal/10 text-signal-bright"
                : "border-line text-text-dim hover:border-signal-line hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/*
        The cue the text tool stamps. Only present while that tool is
        active — a permanently visible word field would be a mystery.
      */}
      {tool === "text" && setLabel && (
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, TEXT_MAX))}
          placeholder="SCAN · HOLD · ARRIVE LATE"
          className="data-mono h-8 w-44 rounded-lg border border-signal-line bg-ink-900 px-2.5 text-xs uppercase text-text-hi placeholder:normal-case placeholder:text-text-faint focus:outline-none"
        />
      )}

      <div className="flex gap-1.5">
        {ANNOTATION_COLORS.map((c) => (
          <button
            key={c.key}
            onClick={() => setColor(c.key)}
            aria-label={c.label}
            title={c.label}
            /*
              A ring set off from the swatch, not a border on it. A
              border paints over the edge of the fill, so on five discs
              of five different colours the selected one looked barely
              different from the rest — which for the control that
              decides what a mark MEANS is not good enough.
            */
            className={cn(
              "size-6 rounded-full transition-all",
              color === c.key
                ? "ring-2 ring-text-hi ring-offset-2 ring-offset-ink-900"
                : "opacity-70 hover:opacity-100",
            )}
            style={{ background: c.css }}
          />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="data-mono text-[10px] text-text-faint">
          {count}/{MAX_SHAPES}
        </span>
        <button
          onClick={onUndo}
          disabled={count === 0}
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-40"
        >
          Undo
        </button>
        {onRedo && (
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-signal-line hover:text-text disabled:opacity-40"
          >
            Redo
          </button>
        )}
        <button
          onClick={onClear}
          disabled={count === 0}
          className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-text-dim transition-colors hover:border-correction hover:text-correction disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
