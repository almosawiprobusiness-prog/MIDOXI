/*
  What sits on the grass: zones, movements, entities, notes.

  One layer per concern (§38), all server-safe. Every layer takes an
  optional `onPick` so the editor can make things selectable without
  forking the rendering — the read-only viewer simply passes nothing and
  gets an inert picture with no event handlers attached.

  COLOUR COMES FROM MEANING. Nothing here takes a colour prop: a press is
  red because `pathMeta("press")` says so, and a goalkeeper is distinct
  because the entity kind says so. That is what stops the picture and the
  data drifting apart — you cannot draw a green press.
*/

import { arcPath, toSvg, type PitchView } from "@/lib/tactics/geometry";
import {
  pathMeta,
  zoneMeta,
  type BoardAnnotation,
  type BoardEntity,
  type BoardPath,
  type BoardZone,
  type EntityKind,
  type PathKind,
} from "@/lib/tactics/types";

type Pick_ = ((id: string) => void) | undefined;

// ── entities ─────────────────────────────────────────────────

/** How each kind is drawn. Radius in board units. */
const ENTITY_STYLE: Record<
  EntityKind,
  { fill: string; stroke: string; text: string; r: number; shape: "circle" | "square" | "triangle" }
> = {
  player: { fill: "var(--signal)", stroke: "var(--signal-bright)", text: "#fff", r: 4.2, shape: "circle" },
  goalkeeper: { fill: "var(--review)", stroke: "#ffd9a0", text: "#231a08", r: 4.2, shape: "circle" },
  opponent: { fill: "var(--ink-700)", stroke: "var(--text-faint)", text: "var(--text-hi)", r: 4.2, shape: "circle" },
  "opponent-goalkeeper": { fill: "var(--ink-800)", stroke: "var(--review)", text: "var(--text-hi)", r: 4.2, shape: "circle" },
  neutral: { fill: "var(--positive)", stroke: "#b6f0d2", text: "#062416", r: 4.2, shape: "circle" },
  ball: { fill: "var(--text-hi)", stroke: "var(--ink-950)", text: "", r: 2.2, shape: "circle" },
  cone: { fill: "var(--review)", stroke: "var(--review)", text: "", r: 1.8, shape: "triangle" },
  mannequin: { fill: "var(--text-faint)", stroke: "var(--text-dim)", text: "", r: 2.2, shape: "square" },
  goal: { fill: "none", stroke: "var(--text-hi)", text: "", r: 5, shape: "square" },
  "mini-goal": { fill: "none", stroke: "var(--text-dim)", text: "", r: 3, shape: "square" },
};

export function EntityLayer({
  entities,
  view,
  onPick,
  selectedId,
  interactive,
}: {
  entities: BoardEntity[];
  view: PitchView;
  onPick?: Pick_;
  selectedId?: string | null;
  interactive?: boolean;
}) {
  return (
    <>
      {entities.map((e) => {
        const p = toSvg(e.x, e.y, view);
        const s = ENTITY_STYLE[e.kind] ?? ENTITY_STYLE.player;
        const selected = selectedId === e.id;
        return (
          <g
            key={e.id}
            onPointerDown={onPick ? (ev) => { ev.stopPropagation(); onPick(e.id); } : undefined}
            style={interactive ? { cursor: "grab" } : undefined}
          >
            {selected && (
              <circle cx={p.px} cy={p.py} r={s.r + 1.8} fill="none" stroke="var(--signal-bright)" strokeWidth="0.6" />
            )}

            {s.shape === "circle" && (
              <circle cx={p.px} cy={p.py} r={s.r} fill={s.fill} stroke={s.stroke} strokeWidth="0.4" />
            )}
            {s.shape === "square" && (
              <rect
                x={p.px - s.r}
                y={p.py - s.r * 0.6}
                width={s.r * 2}
                height={s.r * 1.2}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth="0.5"
                rx="0.6"
              />
            )}
            {s.shape === "triangle" && (
              <polygon
                points={`${p.px},${p.py - s.r} ${p.px + s.r},${p.py + s.r} ${p.px - s.r},${p.py + s.r}`}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth="0.3"
              />
            )}

            {e.label && s.text && (
              <text
                x={p.px}
                y={p.py + 1.3}
                fontSize="3.2"
                textAnchor="middle"
                fill={s.text}
                style={{ pointerEvents: "none", fontWeight: 600 }}
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// ── movements ────────────────────────────────────────────────

/** Arrowheads, one per path kind. Ids are scoped so two boards on one page do not collide. */
export function PathMarkers({ scope }: { scope: string }) {
  const kinds: PathKind[] = ["pass", "run", "dribble", "press", "carry", "cover", "movement", "rotation", "shot"];
  return (
    <defs>
      {kinds.map((k) => (
        <marker
          key={k}
          id={`ah-${scope}-${k}`}
          markerWidth="4"
          markerHeight="4"
          refX="3"
          refY="2"
          orient="auto"
        >
          <path d="M0,0 L4,2 L0,4 z" fill={pathMeta(k).color} />
        </marker>
      ))}
    </defs>
  );
}

export function PathLayer({
  paths,
  view,
  scope,
  onPick,
  interactive,
}: {
  paths: BoardPath[];
  view: PitchView;
  scope: string;
  onPick?: Pick_;
  interactive?: boolean;
}) {
  return (
    <>
      {paths.map((p) => {
        const a = toSvg(p.from.x, p.from.y, view);
        const b = toSvg(p.to.x, p.to.y, view);
        const meta = pathMeta(p.kind);
        const mid = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2 };
        return (
          <g
            key={p.id}
            onPointerDown={onPick ? (ev) => { ev.stopPropagation(); onPick(p.id); } : undefined}
            style={interactive ? { cursor: "pointer" } : undefined}
          >
            {/* A wider invisible line so a 0.9-unit stroke is still tappable. */}
            {interactive && (
              <line x1={a.px} y1={a.py} x2={b.px} y2={b.py} stroke="transparent" strokeWidth="3.5" />
            )}
            {p.curved ? (
              <path
                d={arcPath(a, b)}
                fill="none"
                stroke={meta.color}
                strokeWidth="0.9"
                strokeDasharray={meta.dash}
                markerEnd={`url(#ah-${scope}-${p.kind})`}
              />
            ) : (
              <line
                x1={a.px}
                y1={a.py}
                x2={b.px}
                y2={b.py}
                stroke={meta.color}
                strokeWidth="0.9"
                strokeDasharray={meta.dash}
                markerEnd={`url(#ah-${scope}-${p.kind})`}
              />
            )}
            {p.sequence != null && (
              <>
                <circle cx={a.px} cy={a.py} r="2.4" fill="var(--ink-950)" stroke={meta.color} strokeWidth="0.4" />
                <text
                  x={a.px}
                  y={a.py + 0.9}
                  fontSize="2.6"
                  textAnchor="middle"
                  fill={meta.color}
                  style={{ pointerEvents: "none", fontWeight: 700 }}
                >
                  {p.sequence}
                </text>
              </>
            )}
            {p.label && (
              <text
                x={mid.px}
                y={mid.py - 1.2}
                fontSize="2.8"
                textAnchor="middle"
                fill={meta.color}
                style={{ pointerEvents: "none" }}
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// ── space ────────────────────────────────────────────────────

export function ZoneLayer({
  zones,
  view,
  onPick,
  interactive,
}: {
  zones: BoardZone[];
  view: PitchView;
  onPick?: Pick_;
  interactive?: boolean;
}) {
  const scale = view.h / 100;
  return (
    <>
      {zones.map((z) => {
        const a = toSvg(z.x, z.y + z.h, view);
        const meta = zoneMeta(z.kind);
        const common = {
          fill: meta.color,
          fillOpacity: 0.13,
          stroke: meta.color,
          strokeWidth: 0.4,
          strokeDasharray: "2 2",
        };
        return (
          <g
            key={z.id}
            onPointerDown={onPick ? (ev) => { ev.stopPropagation(); onPick(z.id); } : undefined}
            style={interactive ? { cursor: "pointer" } : undefined}
          >
            {z.shape === "ellipse" ? (
              <ellipse
                cx={a.px + z.w / 2}
                cy={a.py + (z.h * scale) / 2}
                rx={z.w / 2}
                ry={(z.h * scale) / 2}
                {...common}
              />
            ) : (
              <rect x={a.px} y={a.py} width={z.w} height={z.h * scale} rx="1" {...common} />
            )}
            {z.label && (
              <text
                x={a.px + 1.5}
                y={a.py + 4}
                fontSize="3.2"
                fill={meta.color}
                style={{ pointerEvents: "none" }}
              >
                {z.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// ── notes ────────────────────────────────────────────────────

export function AnnotationLayer({
  annotations,
  view,
  onPick,
  interactive,
}: {
  annotations: BoardAnnotation[];
  view: PitchView;
  onPick?: Pick_;
  interactive?: boolean;
}) {
  return (
    <>
      {annotations.map((a) => {
        const p = toSvg(a.x, a.y, view);
        return (
          <g
            key={a.id}
            onPointerDown={onPick ? (ev) => { ev.stopPropagation(); onPick(a.id); } : undefined}
            style={interactive ? { cursor: "pointer" } : undefined}
          >
            <text
              x={p.px}
              y={p.py}
              fontSize="3.4"
              textAnchor="middle"
              fill="var(--text-hi)"
              stroke="var(--ink-950)"
              strokeWidth="0.7"
              paintOrder="stroke"
              style={{ pointerEvents: interactive ? "auto" : "none", fontWeight: 500 }}
            >
              {a.text}
            </text>
          </g>
        );
      })}
    </>
  );
}
