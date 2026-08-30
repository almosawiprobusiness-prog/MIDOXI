import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  dayLabel,
  hrefFor,
  kindMeta,
  timeLabel,
  type TimelineDay,
  type TimelineEntry,
} from "@/lib/data/timeline-types";

/*
  The timeline, rendered.

  A server component on purpose: there is nothing interactive about a record of
  what already happened, and shipping it as static HTML means it also renders
  straight into a printed report with no second implementation.

  Every row points somewhere. A timeline you cannot click out of is a list.
*/

function MatchLine({ meta }: { meta: Record<string, unknown> }) {
  const bits: string[] = [];
  const goals = Number(meta.goals) || 0;
  const assists = Number(meta.assists) || 0;
  if (goals) bits.push(`${goals} ${goals === 1 ? "goal" : "goals"}`);
  if (assists) bits.push(`${assists} ${assists === 1 ? "assist" : "assists"}`);
  if (meta.position) bits.push(String(meta.position));
  if (meta.started === false) bits.push("off the bench");
  if (!bits.length) return null;
  return <span className="text-signal-bright">{bits.join(" · ")}</span>;
}

function CheckinLine({ meta }: { meta: Record<string, unknown> }) {
  const fields: [string, unknown][] = [
    ["energy", meta.energy],
    ["sleep", meta.sleep],
    ["soreness", meta.soreness],
    ["head", meta.mental],
  ];
  const known = fields.filter(([, v]) => v !== null && v !== undefined);
  if (!known.length) return null;
  return (
    <span className="data-mono text-text-faint">
      {known.map(([label, v]) => `${label} ${v}/5`).join("  ")}
    </span>
  );
}

function ObservationLine({ meta }: { meta: Record<string, unknown> }) {
  const n = Number(meta.observationCount) || 0;
  if (!n) return null;
  return (
    <span className="text-text-faint">
      {n} {n === 1 ? "observation" : "observations"}
    </span>
  );
}

/*
  The development thread, named.

  Clip, study and evidence rows carry the goal they serve. Without this
  line the timeline was a well-ordered list of disconnected acts — a
  clip one row away from the goal it evidences, with nothing joining
  them. One phrase turns the list into the story the page promises: you
  can now read DOWN a goal's thread across weeks.
*/
function GoalThread({ meta }: { meta: Record<string, unknown> }) {
  if (typeof meta.goalTitle !== "string") return null;
  return (
    <span className="text-text-faint">
      <span aria-hidden>→ </span>
      <span className="text-signal">{meta.goalTitle}</span>
    </span>
  );
}

function Extra({ entry }: { entry: TimelineEntry }) {
  switch (entry.kind) {
    case "match":
      return <MatchLine meta={entry.meta} />;
    case "checkin":
      return <CheckinLine meta={entry.meta} />;
    case "analysis":
      return <ObservationLine meta={entry.meta} />;
    case "evidence":
      return (
        <span className="flex flex-wrap gap-x-3">
          {entry.meta.concept ? (
            <span className="text-signal">{String(entry.meta.concept).replace(/-/g, " ")}</span>
          ) : null}
          <GoalThread meta={entry.meta} />
        </span>
      );
    case "clip":
    case "study":
      return <GoalThread meta={entry.meta} />;
    default:
      return null;
  }
}

function Row({ entry }: { entry: TimelineEntry }) {
  const meta = kindMeta(entry.kind);
  const href = hrefFor(entry);
  const Icon = meta.icon;

  const body = (
    <>
      {/* Spine + node */}
      <div className="relative flex w-9 shrink-0 justify-center">
        <span
          className="absolute inset-y-0 w-px bg-line"
          aria-hidden
          style={{ top: "-0.75rem", bottom: "-0.75rem" }}
        />
        <span
          className="relative mt-0.5 grid size-7 place-items-center rounded-full border border-line bg-ink-900"
          style={{ color: meta.color }}
        >
          <Icon className="size-3.5" />
        </span>
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="label-tech" style={{ color: meta.color }}>
            {meta.label}
          </span>
          {/*
            A check-in is a date with no time on it. The view places it at
            midday so it cannot fall into the wrong day, and printing that
            midday back would be inventing a moment the player never chose.
          */}
          {entry.kind !== "checkin" && (
            <span className="data-mono text-[10px] text-text-faint">
              {timeLabel(entry.occurredAt)}
            </span>
          )}
          {entry.meta.approximate === true && (
            <span className="data-mono text-[10px] text-text-faint" title="The schema records when the goal was last changed, not the moment it was achieved.">
              approx.
            </span>
          )}
        </div>
        <div className="mt-0.5 text-sm font-medium leading-snug text-text-hi">{entry.title}</div>
        {entry.summary && (
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-text-dim">{entry.summary}</p>
        )}
        <div className="mt-0.5 text-xs">
          <Extra entry={entry} />
        </div>
      </div>

      {href && (
        <ArrowUpRight className="mt-1 size-3.5 shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text" />
      )}
    </>
  );

  const className = "group flex gap-3 px-4 py-3 transition-colors";

  return href ? (
    <Link href={href} className={`${className} hover:bg-ink-850`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function TimelineFeed({ days }: { days: TimelineDay[] }) {
  return (
    <div className="space-y-6">
      {days.map((day, i) =>
        i === 0 ? (
          /*
            The command surface: the most recent day, spoken in the elevated
            voice. Its header moves inside the panel as a band; every older
            day keeps the quiet treatment below.
          */
          <section key={day.date}>
            <div className="relative min-w-0 overflow-hidden rounded-xl border border-signal-line bg-gradient-to-b from-signal/10 via-ink-900 to-ink-900">
              <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
                <div>
                  <div className="label-tech !text-signal-bright">Most recent / 01</div>
                  <h3 className="mt-1 font-display text-sm font-bold uppercase tracking-tight text-text-hi">
                    {dayLabel(day.date)}
                  </h3>
                </div>
                <span className="data-mono text-[10px] text-text-faint">
                  {day.entries.length} {day.entries.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              <div className="divide-y divide-line">
                {day.entries.map((e) => (
                  <Row key={e.id} entry={e} />
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section key={day.date}>
            <div className="mb-2 flex items-baseline gap-3 px-1">
              <h3 className="font-display text-sm font-semibold text-text">{dayLabel(day.date)}</h3>
              <span className="h-px flex-1 bg-line" />
              <span className="data-mono text-[10px] text-text-faint">
                {day.entries.length} {day.entries.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <div className="min-w-0 panel divide-y divide-line">
              {day.entries.map((e) => (
                <Row key={e.id} entry={e} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
