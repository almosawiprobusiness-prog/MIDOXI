import { arrowMeta, type BoardData } from "@/lib/data/coach-types";

/* Read-only board preview. Pure SVG, so it renders on the server. */
export function BoardThumb({ board }: { board: BoardData }) {
  const W = 100;
  const H = 150;
  const toSvg = (x: number, y: number) => ({ px: x, py: (100 - y) * 1.5 });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" aria-hidden>
      <rect x="0" y="0" width={W} height={H} fill="#0c1a12" />
      <g stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" fill="none">
        <rect x="3" y="3" width={W - 6} height={H - 6} />
        <line x1="3" y1={H / 2} x2={W - 3} y2={H / 2} />
        <circle cx={W / 2} cy={H / 2} r="12" />
        <rect x="21" y="3" width="58" height="23" />
        <rect x="21" y={H - 26} width="58" height="23" />
      </g>

      {(board.zones ?? []).map((z) => {
        const a = toSvg(z.x, z.y + z.h);
        return (
          <rect
            key={z.id}
            x={a.px}
            y={a.py}
            width={z.w}
            height={z.h * 1.5}
            fill="rgba(123,97,255,0.12)"
            stroke="var(--signal-line)"
            strokeWidth="0.4"
            strokeDasharray="2 2"
          />
        );
      })}

      {(board.arrows ?? []).map((ar) => {
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
          />
        );
      })}

      {(board.tokens ?? []).map((t) => {
        const p = toSvg(t.x, t.y);
        const home = t.team === "home";
        const ball = t.team === "ball";
        return (
          <circle
            key={t.id}
            cx={p.px}
            cy={p.py}
            r={ball ? 1.8 : t.team === "cone" ? 1.4 : 3.4}
            fill={home ? "var(--signal)" : ball ? "var(--text-hi)" : t.team === "cone" ? "var(--review)" : "var(--ink-700)"}
            stroke={home ? "var(--signal-bright)" : "var(--text-faint)"}
            strokeWidth="0.3"
          />
        );
      })}
    </svg>
  );
}
