import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { TestSeries } from "@/lib/data/trainer-types";

/*
  A test series, plotted honestly.

  Two rules:
  - The y-axis is scaled to the data, and the label says so. No zero-baseline
    trick that makes a 1% change look like a transformation.
  - "Improved" respects the test's direction: a lower 10m sprint is better, a
    higher jump is better. Direction is curated data, not a guess.
*/
export function TrendChart({ series, height = 64 }: { series: TestSeries; height?: number }) {
  const values = series.entries.map((e) => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(0.001, Math.abs(max) * 0.05);
  const W = 100;

  const points = series.entries.map((e, i) => {
    const x = series.entries.length === 1 ? W / 2 : (i / (series.entries.length - 1)) * W;
    // Draw in the improving direction: better is always higher on the chart.
    const norm = (e.value - min) / span;
    const y = series.better === "lower" ? norm * 100 : (1 - norm) * 100;
    return { x, y: Math.max(6, Math.min(94, y)) };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const color = series.improved ? "var(--positive)" : series.changePct === 0 ? "var(--text-dim)" : "var(--review)";
  const Icon = series.improved ? TrendingUp : series.changePct === 0 ? Minus : TrendingDown;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text-hi">{series.label}</div>
          <div className="label-tech mt-0.5">
            {series.entries.length} result{series.entries.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="text-right">
          <div className="stat-figure text-xl">
            {series.latest.value}
            <span className="ml-1 text-xs font-normal text-text-dim">{series.unit}</span>
          </div>
          {series.entries.length > 1 && (
            <div className="flex items-center justify-end gap-1 text-[11px]" style={{ color }}>
              <Icon className="size-3" />
              {series.changePct > 0 ? "+" : ""}
              {series.changePct}%
            </div>
          )}
        </div>
      </div>

      {series.entries.length > 1 && (
        <svg
          viewBox={`0 0 ${W} 100`}
          preserveAspectRatio="none"
          className="mt-2 w-full"
          style={{ height }}
          aria-label={`${series.label} over time`}
        >
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      )}

      <div className="mt-1 flex items-center justify-between text-[10px] text-text-faint">
        <span>
          {new Date(series.first.testedOn).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ·{" "}
          {series.first.value}
          {series.unit}
        </span>
        <span>
          scale {min}–{max}
          {series.unit} · {series.better === "lower" ? "lower is better" : "higher is better"}
        </span>
      </div>
    </div>
  );
}
