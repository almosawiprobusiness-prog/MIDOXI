import Link from "next/link";
import { Radio, Video } from "lucide-react";
import {
  STATUS_LABEL,
  canJoin,
  formatWhen,
  kindMeta,
  minutesBetween,
  relativeWhen,
  type Meeting,
} from "@/lib/data/meeting-types";
import { cn } from "@/lib/utils";

/*
  One meeting in a list.

  The line people actually scan is WHO and WHEN, so those are the two
  things set largest. The status only earns a badge when it is not the
  ordinary case — a "Confirmed" chip on every row is noise that makes
  the one waiting on you harder to spot.

  Times render through `formatWhen`, which names the zone. A coach in
  Manchester and a player in Lagos reading "3pm" is exactly how people
  miss each other by an hour.
*/

export function MeetingRow({ meeting: m }: { meeting: Meeting }) {
  const live = canJoin(m);
  const meta = kindMeta(m.kind);
  const waiting = m.status === "proposed";
  const off = m.status === "cancelled" || m.status === "declined";

  return (
    <Link
      href={`/app/meetings/${m.id}`}
      className={cn(
        "panel flex items-center gap-4 px-4 py-3.5 transition-colors hover:border-signal-line",
        off && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-tech text-text-faint">{meta.label}</span>
          {live && (
            <span className="inline-flex items-center gap-1 rounded-full border border-signal-line bg-signal/10 px-2 py-0.5 text-[10px] font-medium text-signal-bright">
              <Radio className="size-3 animate-pulse" />
              Now
            </span>
          )}
          {waiting && (
            <span className="rounded-full border border-review/40 bg-review/10 px-2 py-0.5 text-[10px] font-medium text-review">
              {m.organiser ? "Waiting on them" : "Needs your answer"}
            </span>
          )}
          {off && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-text-faint">
              {STATUS_LABEL[m.status]}
            </span>
          )}
        </div>

        <p className={cn("mt-0.5 truncate font-medium text-text-hi", off && "line-through decoration-text-faint")}>
          {m.title}
        </p>

        <p className="mt-0.5 truncate text-sm text-text-dim">
          {m.withPerson.name}
          {m.withPerson.position && <span className="text-text-faint"> · {m.withPerson.position}</span>}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm text-text">{formatWhen(m.startsAt)}</p>
        <p className="mt-0.5 data-mono text-[11px] text-text-faint">
          {minutesBetween(m.startsAt, m.endsAt)} min
          {!off && <> · {relativeWhen(m.startsAt)}</>}
        </p>
      </div>

      {m.videoProvider && !off && <Video className="size-4 shrink-0 text-text-faint" />}
    </Link>
  );
}
