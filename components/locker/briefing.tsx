import Link from "next/link";
import { Swords, HeartPulse, ClipboardList, Coffee, ArrowUpRight } from "lucide-react";
import { buildBriefing, type BriefingTone } from "@/lib/data/briefing";
import type { LockerData } from "@/lib/data/locker";
import type { LucideIcon } from "lucide-react";

/*
  The briefing, first thing on the Locker.

  No model call. Every line is a rule over facts the product already holds, so
  it is instant, free, identical every time, and traceable to the thing that
  caused it. That last property is the one that matters: a briefing you cannot
  explain is a horoscope.
*/

const TONE: Record<BriefingTone, { icon: LucideIcon; color: string }> = {
  match: { icon: Swords, color: "var(--signal-bright)" },
  body: { icon: HeartPulse, color: "var(--review)" },
  work: { icon: ClipboardList, color: "var(--text-dim)" },
  quiet: { icon: Coffee, color: "var(--text-faint)" },
};

export function Briefing({ data }: { data: LockerData }) {
  const lines = buildBriefing(data);

  return (
    <div className="min-w-0 panel-raised overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3">
        <span className="label-tech">Today</span>
        <span className="label-tech">
          {lines.length} {lines.length === 1 ? "thing" : "things"}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {lines.map((line) => {
          const tone = TONE[line.tone];
          const Icon = tone.icon;
          return (
            <li key={line.id} className="flex items-start gap-3 px-5 py-4">
              <Icon className="mt-0.5 size-4 shrink-0" style={{ color: tone.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-hi">{line.headline}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-text-dim">{line.detail}</p>
              </div>
              {line.action && (
                <Link
                  href={line.action.href}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-text-faint transition-colors hover:text-signal-bright"
                >
                  {line.action.label}
                  <ArrowUpRight className="size-3.5" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
