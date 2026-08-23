import {
  Swords,
  Dumbbell,
  HeartPulse,
  Scissors,
  Eye,
  GraduationCap,
  BookOpen,
  Target,
  Trophy,
  Paperclip,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

/*
  The player timeline — types and presentation.

  Client-safe: no server imports, no data access. Everything here is either a
  shape or a pure function, so the same definitions render on the server, in the
  report, and in any client component that needs them.

  The timeline is a chronological spine over things that already happened. It
  invents nothing: every entry points at a row somewhere else, and the view that
  produces them (`player_timeline`, migration 0015) is read-only by construction.
*/

export type TimelineKind =
  | "match"
  | "training"
  | "checkin"
  | "clip"
  | "analysis"
  | "study"
  | "study_session"
  | "goal_set"
  | "goal_reached"
  | "evidence"
  | "feedback";

export interface TimelineEntry {
  /** `kind:refId` — unique across kinds, stable across reads. */
  id: string;
  /** When it HAPPENED, not when it was entered. */
  occurredAt: string;
  kind: TimelineKind;
  refId: string;
  title: string;
  summary: string | null;
  meta: Record<string, unknown>;
}

export interface TimelineDay {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  entries: TimelineEntry[];
}

export interface TimelineView {
  source: "demo" | "yours";
  days: TimelineDay[];
  /** Every entry, flat and newest-first — for counting and for reports. */
  entries: TimelineEntry[];
  /** The window that was read, so the UI can say what it is showing. */
  from: string;
  to: string;
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export interface KindMeta {
  kind: TimelineKind;
  label: string;
  icon: LucideIcon;
  /** CSS custom property or literal. Matches the palette used elsewhere. */
  color: string;
  /** Which filter group this belongs to in the UI. */
  group: "football" | "work" | "development";
}

export const KIND_META: Record<TimelineKind, KindMeta> = {
  match:         { kind: "match",         label: "Match",     icon: Swords,        color: "var(--signal-bright)", group: "football" },
  training:      { kind: "training",      label: "Training",  icon: Dumbbell,      color: "var(--positive)",      group: "football" },
  checkin:       { kind: "checkin",       label: "Check-in",  icon: HeartPulse,    color: "var(--info)",          group: "football" },
  clip:          { kind: "clip",          label: "Clip",      icon: Scissors,      color: "#c58bff",              group: "work" },
  analysis:      { kind: "analysis",      label: "Film read", icon: Eye,           color: "#c58bff",              group: "work" },
  study:         { kind: "study",         label: "Study",     icon: GraduationCap, color: "var(--info)",          group: "work" },
  study_session: { kind: "study_session", label: "Film study",icon: BookOpen,      color: "var(--info)",          group: "work" },
  goal_set:      { kind: "goal_set",      label: "Goal set",  icon: Target,        color: "var(--signal)",        group: "development" },
  goal_reached:  { kind: "goal_reached",  label: "Achieved",  icon: Trophy,        color: "var(--positive)",      group: "development" },
  evidence:      { kind: "evidence",      label: "Evidence",  icon: Paperclip,     color: "var(--signal)",        group: "development" },
  feedback:      { kind: "feedback",      label: "Coach",     icon: MessageSquare, color: "var(--review)",        group: "development" },
};

export const TIMELINE_KINDS = Object.keys(KIND_META) as TimelineKind[];

export const FILTER_GROUPS: { id: KindMeta["group"]; label: string; kinds: TimelineKind[] }[] = [
  { id: "football",    label: "On the pitch",  kinds: TIMELINE_KINDS.filter((k) => KIND_META[k].group === "football") },
  { id: "work",        label: "Film & study",  kinds: TIMELINE_KINDS.filter((k) => KIND_META[k].group === "work") },
  { id: "development", label: "Development",   kinds: TIMELINE_KINDS.filter((k) => KIND_META[k].group === "development") },
];

export function kindMeta(kind: TimelineKind): KindMeta {
  return KIND_META[kind] ?? KIND_META.match;
}

/** Where an entry links to. Null when the row has no page of its own. */
export function hrefFor(entry: TimelineEntry): string | null {
  const videoId = entry.meta.videoId as string | undefined;
  switch (entry.kind) {
    case "match":
      return `/app/matches/${entry.refId}`;
    case "clip":
    case "analysis":
      return videoId ? `/app/film-room/${videoId}` : "/app/film-room";
    case "study":
      return `/app/study/${entry.refId}`;
    case "study_session":
      return "/app/study";
    case "goal_set":
    case "goal_reached":
      return `/app/development/${entry.refId}`;
    case "evidence": {
      const goalId = entry.meta.goalId as string | undefined;
      return goalId ? `/app/development/${goalId}` : "/app/development";
    }
    case "training":
      return "/app/training";
    case "checkin":
      return "/app/recovery";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shaping
// ---------------------------------------------------------------------------

/** yyyy-mm-dd in the viewer's own reckoning of the day, not UTC. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/**
 * Newest first, grouped by day.
 *
 * Within a day the order is by time, then by kind weight — a match sits above
 * the check-in from the same morning, because that is the order a person
 * remembers the day in.
 */
const WEIGHT: Record<TimelineKind, number> = {
  match: 0,
  goal_reached: 1,
  analysis: 2,
  clip: 3,
  evidence: 4,
  feedback: 5,
  training: 6,
  study: 7,
  study_session: 8,
  goal_set: 9,
  checkin: 10,
};

export function groupByDay(entries: TimelineEntry[]): TimelineDay[] {
  const days = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const key = dayKey(e.occurredAt);
    const bucket = days.get(key);
    if (bucket) bucket.push(e);
    else days.set(key, [e]);
  }
  return [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      entries: list.sort((a, b) => {
        const t = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
        return t !== 0 ? t : WEIGHT[a.kind] - WEIGHT[b.kind];
      }),
    }));
}

/** How many of each kind, for the summary line and the report. */
export function countByKind(entries: TimelineEntry[]): Record<TimelineKind, number> {
  const out = Object.fromEntries(TIMELINE_KINDS.map((k) => [k, 0])) as Record<TimelineKind, number>;
  for (const e of entries) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

/** Minutes played across the matches in a set of entries. */
export function minutesPlayed(entries: TimelineEntry[]): number {
  return entries
    .filter((e) => e.kind === "match")
    .reduce((sum, e) => sum + (Number(e.meta.minutes) || 0), 0);
}

export function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 864e5).toISOString());
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * "1 film read", not "1 film reads".
 *
 * A record of one thing is the commonest case on a new account — the first
 * clip, the first goal, the first piece of evidence — so this is the string a
 * player is most likely to see, and getting it wrong makes the whole page read
 * as unfinished.
 */
export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}
