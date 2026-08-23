"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, ChevronRight } from "lucide-react";
import type { Match } from "@/lib/types";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}
function outcome(m: Match): "W" | "D" | "L" {
  return m.goalsFor > m.goalsAgainst ? "W" : m.goalsFor === m.goalsAgainst ? "D" : "L";
}
const RESULT_STYLE: Record<string, { color: string; wash: string }> = {
  W: { color: "var(--positive)", wash: "var(--positive-wash)" },
  D: { color: "var(--review)", wash: "var(--review-wash)" },
  L: { color: "var(--correction)", wash: "var(--correction-wash)" },
};

type Filter = "all" | "W" | "D" | "L" | "home" | "away";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "W", label: "Won" },
  { key: "D", label: "Drawn" },
  { key: "L", label: "Lost" },
  { key: "home", label: "Home" },
  { key: "away", label: "Away" },
];

export function MatchList({ matches }: { matches: Match[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const shown = matches.filter((m) => {
    if (filter === "all") return true;
    if (filter === "home") return m.home;
    if (filter === "away") return !m.home;
    return outcome(m) === filter;
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count =
            f.key === "all" ? matches.length
            : f.key === "home" ? matches.filter((m) => m.home).length
            : f.key === "away" ? matches.filter((m) => !m.home).length
            : matches.filter((m) => outcome(m) === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-signal-line bg-signal/10 text-signal-bright"
                  : "border-line text-text-dim hover:border-line-strong hover:text-text"
              }`}
            >
              {f.label}
              <span className="data-mono text-[10px] text-text-faint">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="panel divide-y divide-line overflow-hidden">
        {shown.map((m) => {
          const r = outcome(m);
          const rs = RESULT_STYLE[r];
          return (
            <Link
              key={m.id}
              href={`/app/matches/${m.id}`}
              className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-ink-850"
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-md font-display text-sm font-bold"
                style={{ color: rs.color, background: rs.wash }}
              >
                {r}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-text-hi">
                    {m.home ? "vs" : "@"} {m.opponent}
                  </span>
                  <span className="data-mono text-xs text-text-dim">{m.goalsFor}–{m.goalsAgainst}</span>
                  {!m.reviewed && <span className="chip !border-review/30 !text-review">Review due</span>}
                </div>
                <div className="label-tech mt-0.5 truncate">{m.competition || "—"} · {fmtDate(m.date)}</div>
              </div>
              <div className="hidden items-center gap-5 sm:flex">
                <Stat label="Pos" value={m.position} />
                <Stat label="Min" value={m.minutes} />
                <Stat label="G/A" value={`${m.goals}/${m.assists}`} />
                {m.rating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="size-3.5 text-review" fill="var(--review)" />
                    <span className="stat-figure text-base">{m.rating}</span>
                  </div>
                )}
              </div>
              <ChevronRight className="size-4 text-text-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
        {shown.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-text-dim">No matches match this filter.</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-right">
      <div className="data-mono text-sm text-text">{value}</div>
      <div className="label-tech">{label}</div>
    </div>
  );
}
