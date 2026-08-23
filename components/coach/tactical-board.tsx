"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MousePointer2,
  Move,
  Spline,
  Square,
  Circle,
  Eraser,
  Save,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { saveBoard, removeBoard } from "@/app/app/tactics/actions";
import {
  ARROW_KINDS,
  BOARD_PHASES,
  FORMATION_NAMES,
  arrowMeta,
  boardFromFormation,
  type ArrowKind,
  type BoardArrow,
  type BoardData,
  type BoardPhase,
  type BoardToken,
  type BoardZone,
  type TacticalBoard,
  type TokenTeam,
} from "@/lib/data/coach-types";
import { cn } from "@/lib/utils";
import { ConfirmDelete, FormError, FormNote } from "@/components/forms/ui";

/*
  The tactical board.

  Coordinates are stored normalised (0–100 on both axes, attacking upwards) so a
  board renders identically at any size and can be reused inside a session plan
  or an opposition report later. The SVG works in a 100x150 space — pitch-shaped,
  so circles stay circular.
*/

const W = 100;
const H = 150;

const toSvg = (x: number, y: number) => ({ px: x, py: (100 - y) * 1.5 });
const fromSvg = (px: number, py: number) => ({ x: px, y: 100 - py / 1.5 });

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

/** Keep receiving pointer events if the cursor leaves the element mid-drag. */
function capture(e: React.PointerEvent) {
  try {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  } catch {
    // Pointer already released, or a synthetic event — dragging still works.
  }
}

type Tool = "select" | "arrow" | "zone" | "home" | "away" | "cone" | "erase";

const TOOLS: { tool: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { tool: "select", label: "Move", icon: MousePointer2 },
  { tool: "arrow", label: "Arrow", icon: Spline },
  { tool: "zone", label: "Zone", icon: Square },
  { tool: "home", label: "Player", icon: Circle },
  { tool: "away", label: "Opponent", icon: Circle },
  { tool: "cone", label: "Cone", icon: Move },
  { tool: "erase", label: "Erase", icon: Eraser },
];

const TEAM_STYLE: Record<TokenTeam, { fill: string; stroke: string; text: string; r: number }> = {
  home: { fill: "var(--signal)", stroke: "var(--signal-bright)", text: "#fff", r: 4.2 },
  away: { fill: "var(--ink-700)", stroke: "var(--text-faint)", text: "var(--text-hi)", r: 4.2 },
  ball: { fill: "var(--text-hi)", stroke: "var(--ink-950)", text: "", r: 2.2 },
  cone: { fill: "var(--review)", stroke: "var(--review)", text: "", r: 1.8 },
};

let seq = 0;
const nextId = (p: string) => `${p}${Date.now().toString(36)}${seq++}`;

export function TacticalBoardEditor({ board }: { board: TacticalBoard }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);

  const [title, setTitle] = useState(board.title);
  const [phase, setPhase] = useState<BoardPhase>(board.phase);
  const [formation, setFormation] = useState(board.formation || "4-3-3");
  const [notes, setNotes] = useState(board.notes);
  const [data, setData] = useState<BoardData>({
    tokens: board.board?.tokens ?? [],
    arrows: board.board?.arrows ?? [],
    zones: board.board?.zones ?? [],
  });

  const [tool, setTool] = useState<Tool>("select");
  const [arrowKind, setArrowKind] = useState<ArrowKind>("run");
  const [dragging, setDragging] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [dirty, setDirty] = useState(false);

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const update = (patch: Partial<BoardData>) => {
    setData((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  /** Pointer position in normalised pitch coordinates. */
  const point = (e: React.PointerEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 50, y: 50 };
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    const { x, y } = fromSvg(px, py);
    return { x: clamp(x), y: clamp(y) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = point(e);
    if (tool === "arrow" || tool === "zone") {
      setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      capture(e);
      return;
    }
    if (tool === "home" || tool === "away" || tool === "cone") {
      const count = data.tokens.filter((t) => t.team === tool).length + 1;
      const token: BoardToken = {
        id: nextId("t"),
        team: tool,
        label: tool === "cone" ? "" : String(count),
        x: p.x,
        y: p.y,
      };
      update({ tokens: [...data.tokens, token] });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (draft) {
      const p = point(e);
      setDraft({ ...draft, x2: p.x, y2: p.y });
      return;
    }
    if (dragging) {
      const p = point(e);
      update({
        tokens: data.tokens.map((t) => (t.id === dragging ? { ...t, x: p.x, y: p.y } : t)),
      });
    }
  };

  const onPointerUp = () => {
    if (draft) {
      const dx = Math.abs(draft.x2 - draft.x1);
      const dy = Math.abs(draft.y2 - draft.y1);
      if (tool === "arrow" && (dx > 1.5 || dy > 1.5)) {
        const arrow: BoardArrow = { id: nextId("a"), kind: arrowKind, ...draft };
        update({ arrows: [...data.arrows, arrow] });
      } else if (tool === "zone" && dx > 3 && dy > 3) {
        const zone: BoardZone = {
          id: nextId("z"),
          x: Math.min(draft.x1, draft.x2),
          y: Math.min(draft.y1, draft.y2),
          w: dx,
          h: dy,
          label: "",
        };
        update({ zones: [...data.zones, zone] });
      }
      setDraft(null);
    }
    setDragging(null);
  };

  const erase = (kind: "token" | "arrow" | "zone", id: string) => {
    if (tool !== "erase") return;
    if (kind === "token") update({ tokens: data.tokens.filter((t) => t.id !== id) });
    if (kind === "arrow") update({ arrows: data.arrows.filter((a) => a.id !== id) });
    if (kind === "zone") update({ zones: data.zones.filter((z) => z.id !== id) });
  };

  const applyFormation = (f: string) => {
    setFormation(f);
    const fresh = boardFromFormation(f);
    // Keep whatever the coach has drawn; only the shape is replaced.
    update({ tokens: [...fresh.tokens] });
  };

  const save = () => {
    setError(null);
    setNote(null);
    start(async () => {
      const res = await saveBoard(board.id, { title, formation, phase, board: data, notes });
      if (res.ok) {
        setDirty(false);
        setNote(res.message ?? "Board saved.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* ── the pitch ── */}
      <div className="min-w-0 panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-2">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.tool;
            return (
              <button
                key={t.tool}
                onClick={() => setTool(t.tool)}
                title={t.label}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                  active
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-dim hover:border-line-strong hover:text-text",
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}

          {tool === "arrow" && (
            <div className="ml-1 flex items-center gap-1 border-l border-line pl-2">
              {ARROW_KINDS.map((a) => (
                <button
                  key={a.kind}
                  onClick={() => setArrowKind(a.kind)}
                  className="h-8 rounded-lg border px-2 text-xs transition-colors"
                  style={
                    arrowKind === a.kind
                      ? { borderColor: a.color, color: a.color, background: "var(--signal-wash)" }
                      : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => update({ arrows: [], zones: [] })}
            title="Clear drawings"
            className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-text-dim transition-colors hover:border-line-strong hover:text-text"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Clear drawings</span>
          </button>
        </div>

        <div className="bg-ink-950 p-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="mx-auto block w-full max-w-[520px] touch-none select-none"
            style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <defs>
              {ARROW_KINDS.map((a) => (
                <marker
                  key={a.kind}
                  id={`head-${a.kind}`}
                  markerWidth="4"
                  markerHeight="4"
                  refX="3"
                  refY="2"
                  orient="auto"
                >
                  <path d="M0,0 L4,2 L0,4 z" fill={a.color} />
                </marker>
              ))}
            </defs>

            {/* pitch */}
            <rect x="0" y="0" width={W} height={H} fill="#0c1a12" />
            <g stroke="rgba(255,255,255,0.22)" strokeWidth="0.5" fill="none">
              <rect x="3" y="3" width={W - 6} height={H - 6} />
              <line x1="3" y1={H / 2} x2={W - 3} y2={H / 2} />
              <circle cx={W / 2} cy={H / 2} r="12" />
              <circle cx={W / 2} cy={H / 2} r="0.8" fill="rgba(255,255,255,0.22)" />
              {/* own goal end (bottom) */}
              <rect x="21" y="3" width="58" height="23" />
              <rect x="37" y="3" width="26" height="8" />
              <circle cx={W / 2} cy="18" r="0.8" fill="rgba(255,255,255,0.22)" />
              {/* attacking end (top) */}
              <rect x="21" y={H - 26} width="58" height="23" />
              <rect x="37" y={H - 11} width="26" height="8" />
              <circle cx={W / 2} cy={H - 18} r="0.8" fill="rgba(255,255,255,0.22)" />
            </g>

            {/* zones */}
            {data.zones.map((z) => {
              const a = toSvg(z.x, z.y + z.h);
              return (
                <g key={z.id} onPointerDown={() => erase("zone", z.id)}>
                  <rect
                    x={a.px}
                    y={a.py}
                    width={z.w}
                    height={z.h * 1.5}
                    fill="rgba(123,97,255,0.12)"
                    stroke="var(--signal-line)"
                    strokeWidth="0.4"
                    strokeDasharray="2 2"
                    rx="1"
                  />
                  {z.label && (
                    <text x={a.px + 1.5} y={a.py + 4} fontSize="3.5" fill="var(--signal-bright)">
                      {z.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* arrows */}
            {data.arrows.map((ar) => {
              const p1 = toSvg(ar.x1, ar.y1);
              const p2 = toSvg(ar.x2, ar.y2);
              const meta = arrowMeta(ar.kind);
              return (
                <line
                  key={ar.id}
                  x1={p1.px}
                  y1={p1.py}
                  x2={p2.px}
                  y2={p2.py}
                  stroke={meta.color}
                  strokeWidth="0.9"
                  strokeDasharray={meta.dash}
                  markerEnd={`url(#head-${ar.kind})`}
                  onPointerDown={() => erase("arrow", ar.id)}
                  style={{ cursor: tool === "erase" ? "pointer" : "inherit" }}
                />
              );
            })}

            {/* draft shape */}
            {draft && tool === "arrow" && (
              <line
                x1={toSvg(draft.x1, draft.y1).px}
                y1={toSvg(draft.x1, draft.y1).py}
                x2={toSvg(draft.x2, draft.y2).px}
                y2={toSvg(draft.x2, draft.y2).py}
                stroke={arrowMeta(arrowKind).color}
                strokeWidth="0.9"
                strokeDasharray={arrowMeta(arrowKind).dash || "1 1"}
                opacity="0.7"
              />
            )}
            {draft && tool === "zone" && (
              <rect
                x={Math.min(draft.x1, draft.x2)}
                y={toSvg(0, Math.max(draft.y1, draft.y2)).py}
                width={Math.abs(draft.x2 - draft.x1)}
                height={Math.abs(draft.y2 - draft.y1) * 1.5}
                fill="rgba(123,97,255,0.1)"
                stroke="var(--signal-line)"
                strokeWidth="0.4"
                strokeDasharray="2 2"
              />
            )}

            {/* tokens */}
            {data.tokens.map((t) => {
              const p = toSvg(t.x, t.y);
              const s = TEAM_STYLE[t.team];
              return (
                <g
                  key={t.id}
                  onPointerDown={(e) => {
                    if (tool === "erase") return erase("token", t.id);
                    if (tool !== "select") return;
                    e.stopPropagation();
                    setDragging(t.id);
                    capture(e);
                  }}
                  style={{ cursor: tool === "select" ? "grab" : tool === "erase" ? "pointer" : "inherit" }}
                >
                  <circle cx={p.px} cy={p.py} r={s.r} fill={s.fill} stroke={s.stroke} strokeWidth="0.4" />
                  {t.label && (
                    <text
                      x={p.px}
                      y={p.py + 1.3}
                      fontSize="3.2"
                      textAnchor="middle"
                      fill={s.text}
                      style={{ pointerEvents: "none", fontWeight: 600 }}
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2">
          <span className="label-tech">Attacking ↑</span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {ARROW_KINDS.map((a) => (
              <span key={a.kind} className="flex items-center gap-1 text-[10px] text-text-dim">
                <span className="inline-block h-px w-4" style={{ background: a.color }} />
                {a.label}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* ── the panel ── */}
      <div className="space-y-3">
        <div className="panel p-4">
          <label className="block">
            <span className="label-tech mb-1 block">Title</span>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              className="h-10 w-full rounded-lg border border-line bg-ink-850 px-3 text-sm text-text-hi focus:border-signal-line focus:outline-none"
            />
          </label>

          <div className="mt-3">
            <span className="label-tech mb-1 block">Formation</span>
            <div className="flex flex-wrap gap-1.5">
              {FORMATION_NAMES.map((f) => (
                <button
                  key={f}
                  onClick={() => applyFormation(f)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    formation === f
                      ? "border-signal-line bg-signal/10 text-signal-bright"
                      : "border-line text-text-dim hover:border-line-strong hover:text-text",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-text-faint">
              Applying a formation repositions your team; drawings stay.
            </p>
          </div>

          <div className="mt-3">
            <span className="label-tech mb-1 block">Phase</span>
            <div className="flex flex-wrap gap-1.5">
              {BOARD_PHASES.map((p) => (
                <button
                  key={p.phase}
                  onClick={() => {
                    setPhase(p.phase);
                    setDirty(true);
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                    phase === p.phase
                      ? "border-signal-line bg-signal/10 text-signal-bright"
                      : "border-line text-text-dim hover:border-line-strong hover:text-text",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-3 block">
            <span className="label-tech mb-1 block">Notes</span>
            <textarea
              value={notes}
              rows={4}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
              }}
              placeholder="What is this board teaching? What does it create for the opponent?"
              className="w-full resize-y rounded-lg border border-line bg-ink-850 px-3 py-2 text-sm leading-relaxed text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
            />
          </label>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={save}
              disabled={pending}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-signal text-sm font-medium text-white transition-colors hover:bg-signal-deep disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {dirty ? "Save board" : "Saved"}
            </button>
            <ConfirmDelete onConfirm={() => removeBoard(board.id)} compact />
          </div>

          <FormError error={error} />
          <FormNote message={note} />
        </div>

        <div className="panel p-4">
          <div className="label-tech">On the board</div>
          <dl className="mt-2 space-y-1.5 text-sm">
            {[
              { label: "Your players", value: data.tokens.filter((t) => t.team === "home").length },
              { label: "Opponents", value: data.tokens.filter((t) => t.team === "away").length },
              { label: "Arrows", value: data.arrows.length },
              { label: "Zones", value: data.zones.length },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <dt className="text-text-dim">{r.label}</dt>
                <dd className="data-mono text-text">{r.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-text-faint">
            Drag with <span className="text-text-dim">Move</span>. Draw with{" "}
            <span className="text-text-dim">Arrow</span> or <span className="text-text-dim">Zone</span>.
            Click a token or line with <span className="text-text-dim">Erase</span> to remove it.
          </p>
        </div>

        {!dirty && (
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-text-faint">
            <Trash2 className="size-3" /> Deleting a board cannot be undone.
          </p>
        )}
      </div>
    </div>
  );
}
