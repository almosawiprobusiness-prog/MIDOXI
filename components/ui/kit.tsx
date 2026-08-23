import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/* Shared page furniture + lightweight, dependency-free data viz. */

export function PageHeader({
  icon: Icon,
  title,
  tagline,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  tagline?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <span className="grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-signal-bright">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">{title}</h1>
        {tagline && <p className="text-sm text-text-dim">{tagline}</p>}
      </div>
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export type Trend = "up" | "down" | "flat";

export function TrendTag({ trend }: { trend?: Trend }) {
  if (!trend) return null;
  const map = {
    up: { Icon: TrendingUp, cls: "text-positive" },
    down: { Icon: TrendingDown, cls: "text-review" },
    flat: { Icon: Minus, cls: "text-text-faint" },
  } as const;
  const { Icon, cls } = map[trend];
  return <Icon className={cn("size-3.5", cls)} />;
}

export interface Stat {
  label: string;
  value: string | number;
  trend?: Trend;
  hint?: string;
}

/** Edge-to-edge KPI band with hairline dividers. */
export function StatBand({ stats, cols = 4 }: { stats: Stat[]; cols?: number }) {
  const colClass =
    cols === 8 ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
    : cols === 6 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
    : cols === 3 ? "grid-cols-3"
    : "grid-cols-2 sm:grid-cols-4";
  return (
    <div className={cn("panel grid gap-px overflow-hidden bg-line", colClass)}>
      {stats.map((s) => (
        <div key={s.label} className="bg-ink-900 p-4">
          <div className="flex items-center gap-1.5">
            <div className="stat-figure text-2xl">{s.value}</div>
            <TrendTag trend={s.trend} />
          </div>
          <div className="label-tech mt-1 truncate" title={s.hint ?? s.label}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Vertical mini bar chart (workload, RPE, ratings…). */
export function MiniBars({
  data,
  className,
  colorFor,
}: {
  data: { label?: string; value: number; sub?: number }[];
  className?: string;
  colorFor?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value + (d.sub ?? 0)), 1);
  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      {data.map((d, i) => {
        const h = Math.max((d.value / max) * 100, 4);
        const subH = d.sub ? (d.sub / max) * 100 : 0;
        return (
          <div key={i} className="group flex flex-1 flex-col items-center gap-1" title={d.label ? `${d.label}: ${d.value}` : `${d.value}`}>
            <div className="flex w-full flex-1 flex-col justify-end overflow-hidden rounded-t-sm" style={{ minHeight: 0 }}>
              {d.sub != null && <div className="w-full bg-signal-bright/80" style={{ height: `${subH}%` }} />}
              <div
                className="w-full rounded-t-sm transition-colors"
                style={{ height: `${h}%`, background: colorFor ? colorFor(d.value) : "color-mix(in oklab, var(--signal) 70%, transparent)" }}
              />
            </div>
            {d.label && <span className="label-tech">{d.label}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal progress row with label + value. */
export function ProgressRow({
  label,
  value,
  max = 100,
  color = "var(--signal)",
  valueLabel,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
  valueLabel?: string;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-text-dim">{label}</span>
        <span className="data-mono text-text">{valueLabel ?? value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Circular readiness / progress dial. */
export function Radial({
  value,
  size = 120,
  label,
  sub,
  color = "var(--signal)",
}: {
  value: number; // 0–100
  size?: number;
  label?: string;
  sub?: string;
  color?: string;
}) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-800)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="stat-figure text-2xl leading-none">{Math.round(value)}{label ? "" : ""}</span>
        {sub && <span className="label-tech mt-1">{sub}</span>}
      </div>
    </div>
  );
}

/** Form string — recent results as pips. */
export function FormPips({ results }: { results: ("W" | "D" | "L")[] }) {
  const style: Record<string, string> = {
    W: "bg-positive/15 text-positive border-positive/30",
    D: "bg-ink-800 text-text-dim border-line",
    L: "bg-review/15 text-review border-review/30",
  };
  return (
    <div className="flex gap-1.5">
      {results.map((r, i) => (
        <span key={i} className={cn("grid size-6 place-items-center rounded-md border text-xs font-semibold", style[r])}>
          {r}
        </span>
      ))}
    </div>
  );
}

export const STUDY_AREA_COLOR: Record<string, string> = {
  finishing: "var(--signal-bright)",
  movement: "#c58bff",
  pressing: "var(--review)",
  scanning: "var(--info)",
  "first-touch": "var(--positive)",
  "decision-making": "var(--correction)",
  positioning: "var(--signal)",
  analysis: "var(--text-dim)",
};
