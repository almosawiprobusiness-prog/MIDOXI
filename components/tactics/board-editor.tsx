"use client";

import { useReducer, useRef, useState } from "react";
import {
  MousePointer2,
  Spline,
  Square,
  Circle,
  Eraser,
  Type,
  Undo2,
  Redo2,
  RotateCcw,
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { pitchView, pointerToBoard, distance } from "@/lib/tactics/geometry";
import { boardId } from "@/lib/tactics/document";
import {
  canRedo,
  canUndo,
  currentFrame,
  editorReducer,
  initEditor,
} from "@/lib/tactics/editor-state";
import {
  ENTITY_KINDS,
  PATH_KINDS,
  ZONE_KINDS,
  pathMeta,
  type EntityKind,
  type PathKind,
  type PitchSpec,
  type TacticalDocument,
  type ZoneKind,
} from "@/lib/tactics/types";
import { cn } from "@/lib/utils";
import { PitchSurface } from "./pitch";
import { AnnotationLayer, EntityLayer, PathLayer, PathMarkers, ZoneLayer } from "./layers";

/*
  The editing surface.

  Deliberately knows nothing about routes, server actions or where the
  board is stored. It takes a document and hands changed documents back
  through `onChange` — which is what lets the identical component run on
  /app/tactics, inside a session drill, in a Trainer exercise and in a
  Player's personal board. The old editor imported its save action
  directly from the tactics route, so it could never appear anywhere
  else.

  `mode` trims the toolbar rather than forking the component:

    full     everything (Coach OS tactical board)
    drill    equipment and small surfaces to the front (Trainer, drills)
    simple   move, draw, erase (Player OS personal boards)

  All three edit the same document with the same reducer. A board drawn
  by a player in `simple` opens with every tool intact in `full`.
*/

export type EditorMode = "full" | "drill" | "simple";

type Tool = "select" | "path" | "zone" | "entity" | "text" | "erase";

const TOOLS: { tool: Tool; label: string; icon: typeof MousePointer2; modes: EditorMode[] }[] = [
  { tool: "select", label: "Move", icon: MousePointer2, modes: ["full", "drill", "simple"] },
  { tool: "entity", label: "Place", icon: Circle, modes: ["full", "drill", "simple"] },
  { tool: "path", label: "Movement", icon: Spline, modes: ["full", "drill", "simple"] },
  { tool: "zone", label: "Zone", icon: Square, modes: ["full", "drill"] },
  { tool: "text", label: "Label", icon: Type, modes: ["full", "drill"] },
  { tool: "erase", label: "Erase", icon: Eraser, modes: ["full", "drill", "simple"] },
];

/** Which entity kinds each mode offers, in the order they are used. */
const ENTITY_PALETTE: Record<EditorMode, EntityKind[]> = {
  full: ["player", "opponent", "goalkeeper", "opponent-goalkeeper", "neutral", "ball", "cone", "mannequin", "mini-goal"],
  drill: ["player", "cone", "mannequin", "ball", "opponent", "neutral", "mini-goal", "goalkeeper"],
  simple: ["player", "opponent", "ball", "cone"],
};

/** Path kinds each mode offers. Simple mode keeps the four everyone knows. */
const PATH_PALETTE: Record<EditorMode, PathKind[]> = {
  full: ["run", "pass", "dribble", "press", "carry", "cover", "rotation", "shot"],
  drill: ["run", "pass", "dribble", "shot", "movement"],
  simple: ["run", "pass", "dribble", "press"],
};

export interface BoardEditorProps {
  doc: TacticalDocument;
  mode?: EditorMode;
  /** Called on every change. The host owns saving. */
  onChange?: (doc: TacticalDocument, dirty: boolean) => void;
  /** Rendered under the pitch — the host's save button, notes, etc. */
  children?: React.ReactNode;
  /** Hide the frame strip even when the board has several (compact hosts). */
  hideFrames?: boolean;
  className?: string;
}

export function BoardEditor({
  doc,
  mode = "full",
  onChange,
  children,
  hideFrames,
  className,
}: BoardEditorProps) {
  const [state, dispatch] = useReducer(editorReducer, doc, initEditor);
  const svgRef = useRef<SVGSVGElement>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [entityKind, setEntityKind] = useState<EntityKind>(ENTITY_PALETTE[mode][0]);
  const [pathKind, setPathKind] = useState<PathKind>("run");
  const [zoneKind, setZoneKind] = useState<ZoneKind>("space");
  const [dragging, setDragging] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

  const view = pitchView(state.doc.pitch.type);
  const frame = currentFrame(state);
  const tools = TOOLS.filter((t) => t.modes.includes(mode));

  /* One place that both reduces and reports, so the host never sees a
     document the editor has not applied. */
  const run = (action: Parameters<typeof editorReducer>[1]) => {
    const next = editorReducer(state, action);
    dispatch(action);
    if (next.doc !== state.doc) onChange?.(next.doc, next.dirty);
  };

  const at = (e: React.PointerEvent) => pointerToBoard(e, svgRef.current, view);

  const onPointerDown = (e: React.PointerEvent) => {
    const p = at(e);

    if (tool === "path" || tool === "zone") {
      setDraft({ from: p, to: p });
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        // Already released, or synthetic. The drag still works.
      }
      return;
    }

    if (tool === "entity") {
      const isPerson = ["player", "goalkeeper", "opponent", "opponent-goalkeeper", "neutral"].includes(entityKind);
      const count = frame.entities.filter((x) => x.kind === entityKind).length + 1;
      run({
        type: "add-entity",
        entity: {
          id: boardId("e"),
          kind: entityKind,
          x: p.x,
          y: p.y,
          label: isPerson ? String(count) : "",
          role: null,
          playerId: null,
        },
      });
      return;
    }

    if (tool === "text") {
      const text = window.prompt("Label")?.trim();
      if (text) run({ type: "add-annotation", annotation: { id: boardId("n"), x: p.x, y: p.y, text: text.slice(0, 160) } });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (draft) return setDraft({ ...draft, to: at(e) });
    if (dragging) {
      const p = at(e);
      run({ type: "move-entity", id: dragging, x: p.x, y: p.y });
    }
  };

  const onPointerUp = () => {
    if (draft) {
      const moved = distance(draft.from, draft.to);
      /* A click is not a drag. Without a threshold, every stray tap with
         the arrow tool leaves a zero-length arrow nobody can see or grab. */
      if (tool === "path" && moved > 2) {
        run({
          type: "add-path",
          path: {
            id: boardId("p"),
            kind: pathKind,
            from: draft.from,
            to: draft.to,
            entityId: null,
            sequence: null,
            label: "",
            curved: false,
          },
        });
      } else if (tool === "zone" && Math.abs(draft.to.x - draft.from.x) > 3 && Math.abs(draft.to.y - draft.from.y) > 3) {
        run({
          type: "add-zone",
          zone: {
            id: boardId("z"),
            kind: zoneKind,
            x: Math.min(draft.from.x, draft.to.x),
            y: Math.min(draft.from.y, draft.to.y),
            w: Math.abs(draft.to.x - draft.from.x),
            h: Math.abs(draft.to.y - draft.from.y),
            label: "",
            shape: "rect",
          },
        });
      }
      setDraft(null);
    }
    setDragging(null);
  };

  const pick = (id: string) => {
    if (tool === "erase") return run({ type: "erase", id });
    if (tool === "select") {
      setDragging(id);
      run({ type: "select", id });
    }
  };

  const scope = "ed";

  return (
    <div className={cn("min-w-0 panel overflow-hidden", className)}>
      {/* ── toolbar ── */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-2">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.tool}
              type="button"
              onClick={() => setTool(t.tool)}
              title={t.label}
              aria-pressed={tool === t.tool}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                tool === t.tool
                  ? "border-signal-line bg-signal/10 text-signal-bright"
                  : "border-line text-text-dim hover:border-line-strong hover:text-text",
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => run({ type: "undo" })}
            disabled={!canUndo(state)}
            title="Undo"
            aria-label="Undo"
            className="grid size-8 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-line-strong hover:text-text disabled:opacity-40"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => run({ type: "redo" })}
            disabled={!canRedo(state)}
            title="Redo"
            aria-label="Redo"
            className="grid size-8 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-line-strong hover:text-text disabled:opacity-40"
          >
            <Redo2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => run({ type: "clear-drawings" })}
            title="Clear drawings — players stay"
            aria-label="Clear drawings"
            className="grid size-8 place-items-center rounded-lg border border-line text-text-dim transition-colors hover:border-line-strong hover:text-text"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── the palette for the active tool ── */}
      {(tool === "entity" || tool === "path" || tool === "zone") && (
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-1.5">
          {tool === "entity" &&
            ENTITY_PALETTE[mode].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setEntityKind(k)}
                aria-pressed={entityKind === k}
                className={cn(
                  "h-7 rounded-md border px-2 text-[11px] transition-colors",
                  entityKind === k
                    ? "border-signal-line bg-signal/10 text-signal-bright"
                    : "border-line text-text-dim hover:text-text",
                )}
              >
                {ENTITY_KINDS.find((e) => e.kind === k)?.label ?? k}
              </button>
            ))}

          {tool === "path" &&
            PATH_PALETTE[mode].map((k) => {
              const meta = pathMeta(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPathKind(k)}
                  aria-pressed={pathKind === k}
                  title={PATH_KINDS.find((p) => p.kind === k)?.hint}
                  className="h-7 rounded-md border px-2 text-[11px] transition-colors"
                  style={
                    pathKind === k
                      ? { borderColor: meta.color, color: meta.color, background: "var(--signal-wash)" }
                      : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }
                  }
                >
                  {meta.label}
                </button>
              );
            })}

          {tool === "zone" &&
            ZONE_KINDS.map((z) => (
              <button
                key={z.kind}
                type="button"
                onClick={() => setZoneKind(z.kind)}
                aria-pressed={zoneKind === z.kind}
                className="h-7 rounded-md border px-2 text-[11px] transition-colors"
                style={
                  zoneKind === z.kind
                    ? { borderColor: z.color, color: z.color, background: "var(--signal-wash)" }
                    : { borderColor: "var(--line-strong)", color: "var(--text-dim)" }
                }
              >
                {z.label}
              </button>
            ))}
        </div>
      )}

      {/* ── the pitch ── */}
      <div className="bg-ink-950 p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${view.w} ${view.h}`}
          className="mx-auto block w-full max-w-[520px] touch-none select-none"
          style={{ cursor: tool === "select" ? "default" : "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <PathMarkers scope={scope} />
          <PitchSurface pitch={state.doc.pitch} />
          <ZoneLayer zones={frame.zones} view={view} onPick={pick} interactive />
          <PathLayer paths={frame.paths} view={view} scope={scope} onPick={pick} interactive />
          <EntityLayer
            entities={frame.entities}
            view={view}
            onPick={pick}
            selectedId={state.selectedId}
            interactive
          />
          <AnnotationLayer annotations={frame.annotations} view={view} onPick={pick} interactive />

          {/* the shape being dragged out */}
          {draft && tool === "path" && (
            <line
              x1={draft.from.x}
              y1={(100 - draft.from.y) * (view.h / 100)}
              x2={draft.to.x}
              y2={(100 - draft.to.y) * (view.h / 100)}
              stroke={pathMeta(pathKind).color}
              strokeWidth="0.9"
              strokeDasharray={pathMeta(pathKind).dash || "1 1"}
              opacity="0.7"
            />
          )}
          {draft && tool === "zone" && (
            <rect
              x={Math.min(draft.from.x, draft.to.x)}
              y={(100 - Math.max(draft.from.y, draft.to.y)) * (view.h / 100)}
              width={Math.abs(draft.to.x - draft.from.x)}
              height={Math.abs(draft.to.y - draft.from.y) * (view.h / 100)}
              fill="rgba(123,97,255,0.10)"
              stroke="var(--signal-line)"
              strokeWidth="0.4"
              strokeDasharray="2 2"
            />
          )}
        </svg>
      </div>

      {/* ── frames ── */}
      {!hideFrames && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
          <span className="label-tech">
            {state.doc.frames.length > 1 ? `Phase ${state.frameIndex + 1} / ${state.doc.frames.length}` : "Attacking ↑"}
          </span>

          {state.doc.frames.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => run({ type: "go-frame", index: state.frameIndex - 1 })}
                disabled={state.frameIndex === 0}
                aria-label="Previous phase"
                className="grid size-7 place-items-center rounded-md border border-line text-text-dim hover:text-text disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => run({ type: "go-frame", index: state.frameIndex + 1 })}
                disabled={state.frameIndex === state.doc.frames.length - 1}
                aria-label="Next phase"
                className="grid size-7 place-items-center rounded-md border border-line text-text-dim hover:text-text disabled:opacity-40"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => run({ type: "add-frame" })}
              title="Add the next phase"
              className="flex h-7 items-center gap-1.5 rounded-md border border-line px-2 text-[11px] text-text-dim transition-colors hover:border-signal-line hover:text-signal-bright"
            >
              <Plus className="size-3" /> Phase
            </button>
            {state.doc.frames.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => run({ type: "duplicate-frame" })}
                  title="Duplicate this phase"
                  aria-label="Duplicate phase"
                  className="grid size-7 place-items-center rounded-md border border-line text-text-dim hover:text-text"
                >
                  <Copy className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => run({ type: "delete-frame" })}
                  title="Delete this phase"
                  aria-label="Delete phase"
                  className="grid size-7 place-items-center rounded-md border border-line text-text-dim hover:text-correction"
                >
                  <Trash2 className="size-3" />
                </button>
              </>
            )}
          </div>

          {state.doc.frames.length > 1 && (
            <input
              value={frame.caption ?? ""}
              onChange={(e) => run({ type: "set-caption", caption: e.target.value })}
              placeholder="What happens in this phase?"
              className="h-8 w-full rounded-lg border border-line bg-ink-850 px-2.5 text-xs text-text-hi placeholder:text-text-faint focus:border-signal-line focus:outline-none"
            />
          )}
        </div>
      )}

      {/* the legend, and whatever the host puts under the pitch */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        {PATH_PALETTE[mode].slice(0, 5).map((k) => {
          const meta = pathMeta(k);
          return (
            <span key={k} className="flex items-center gap-1 text-[10px] text-text-dim">
              <span className="inline-block h-px w-4" style={{ background: meta.color }} />
              {meta.label}
            </span>
          );
        })}
      </div>

      {children}
    </div>
  );
}

/** Read the pitch spec out for a host that wants to offer surface switching. */
export function pitchSpecFor(type: PitchSpec["type"], dimensions?: string | null): PitchSpec {
  return { type, orientation: "vertical", dimensions: dimensions ?? null };
}
