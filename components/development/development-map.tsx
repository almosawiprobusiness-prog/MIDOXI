import Link from "next/link";
import { Compass, Circle } from "lucide-react";
import {
  CATEGORY_META,
  buildDevelopmentMap,
  mapHeadline,
} from "@/lib/data/development-map";
import type { DevelopmentGoal } from "@/lib/types";

/*
  Current → target → gap, without inventing a single number.

  `current` is what the evidence says, `target` is the goal the player set, and
  `gap` names the next concrete thing to do. There is no rating anywhere, and no
  bar representing an ability nobody measured — the only bar here is goal
  progress, which moves when evidence is attached and not otherwise.

  Untouched areas are shown, not hidden. A map that only draws where you have
  been is a map of nothing.
*/

export function DevelopmentMapPanel({ goals }: { goals: DevelopmentGoal[] }) {
  const map = buildDevelopmentMap(goals);

  return (
    <div className="space-y-3">
      <div className="min-w-0 panel-raised flex items-start gap-3 p-5">
        <Compass className="mt-0.5 size-5 shrink-0 text-signal-bright" />
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-text-hi">{mapHeadline(map)}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-faint">
            {map.covered}/5 areas covered · {map.totalGoals}{" "}
            {map.totalGoals === 1 ? "goal" : "goals"} · {map.totalEvidence}{" "}
            {map.totalEvidence === 1 ? "piece" : "pieces"} of evidence
          </p>
        </div>
      </div>

      <div className="min-w-0 panel divide-y divide-line">
        {map.rows.map((row) => {
          const meta = CATEGORY_META[row.category];
          const empty = row.goals.length === 0;
          return (
            <div key={row.category} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Circle
                    className="size-2.5 shrink-0"
                    style={{ fill: empty ? "var(--ink-700)" : meta.color, color: "transparent" }}
                    aria-hidden
                  />
                  <span
                    className={`font-display text-sm font-semibold ${
                      empty ? "text-text-dim" : "text-text-hi"
                    }`}
                  >
                    {meta.label}
                  </span>
                  <span className="label-tech truncate">{meta.blurb}</span>
                </div>
                <span className="data-mono shrink-0 text-sm text-text">
                  {row.progress === null ? "—" : `${row.progress}%`}
                </span>
              </div>

              {!empty && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${row.progress ?? 0}%`, background: meta.color }}
                  />
                </div>
              )}

              {/* The targets — the player's own goals, named */}
              {row.goals.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {row.goals.map((g) => (
                    <Link
                      key={g.id}
                      href={`/app/development/${g.id}`}
                      className={`chip chip-prose transition-colors hover:border-signal-line hover:text-signal-bright ${
                        g.status === "achieved" ? "!text-text-faint line-through" : ""
                      }`}
                    >
                      {g.title}
                    </Link>
                  ))}
                </div>
              )}

              <p className="mt-2 text-xs leading-relaxed text-text-dim">{row.gap}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-text-faint">
        There are no ability ratings on this map, because nothing in MIDO rates your ability. The
        percentage is goal progress — it moves when you attach evidence, and it is the only number
        here that means anything.
      </p>
    </div>
  );
}
