/*
  Meetings two people share — the shapes, and the rules that are
  small enough to be worth stating exactly once.

  Client-safe: no server imports, so the composer, the agenda and the
  tests all read the same definitions rather than three drifting copies.
*/

export type MeetingKind = "call" | "film" | "check_in" | "review" | "session";
export type MeetingStatus = "proposed" | "confirmed" | "declined" | "cancelled" | "done";
export type AgendaKind = "note" | "clip" | "study" | "goal" | "video";
export type VideoProvider = "daily" | "external";

export interface MeetingPerson {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  position: string | null;
}

export interface AgendaItem {
  id: string;
  position: number;
  kind: AgendaKind;
  title: string;
  body: string | null;
  refClip: string | null;
  refStudy: string | null;
  refVideo: string | null;
  refGoal: string | null;
  atSeconds: number | null;
  done: boolean;
  addedBy: string;
  /** True when the reader added it — only the author may delete. */
  mine: boolean;
}

export interface TimeProposal {
  id: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
  proposedBy: string;
  /** True when the reader made it, so the UI waits rather than asking them to accept their own offer. */
  mine: boolean;
  status: "pending" | "accepted" | "declined" | "superseded";
  createdAt: string;
}

export interface Meeting {
  id: string;
  kind: MeetingKind;
  title: string;
  note: string | null;
  startsAt: string;
  endsAt: string;
  status: MeetingStatus;
  videoProvider: VideoProvider | null;
  videoRoom: string | null;
  externalUrl: string | null;
  /** The other person. Never the reader — a meeting with yourself is not a meeting. */
  withPerson: MeetingPerson;
  /** True when the reader called it. Decides who is asked to accept. */
  organiser: boolean;
  createdAt: string;
}

export interface MeetingDetail extends Meeting {
  agenda: AgendaItem[];
  openProposal: TimeProposal | null;
  history: { action: string; actorId: string; at: string; detail: Record<string, unknown> }[];
}

export const MEETING_KINDS: { kind: MeetingKind; label: string; hint: string }[] = [
  { kind: "film", label: "Film session", hint: "Watch clips together and talk through them" },
  { kind: "call", label: "Call", hint: "A conversation, no agenda needed" },
  { kind: "check_in", label: "Check-in", hint: "How the week has gone" },
  { kind: "review", label: "Review", hint: "Go through a match or a block of work" },
  { kind: "session", label: "Session plan", hint: "Plan what happens on the pitch" },
];

export const DURATIONS = [15, 30, 45, 60, 90] as const;

/** Longest a single meeting may be booked for. */
export const MAX_MINUTES = 240;
export const TITLE_MAX = 120;
export const AGENDA_TITLE_MAX = 160;
export const AGENDA_MAX_ITEMS = 40;

export function kindMeta(kind: MeetingKind) {
  return MEETING_KINDS.find((k) => k.kind === kind) ?? MEETING_KINDS[1];
}

/*
  Fractional ordering.

  Dropping an item between two others writes one row — the midpoint —
  rather than renumbering the whole list, which matters because both
  people can reorder at once and a full renumber makes their edits
  fight. `before`/`after` are the neighbours at the destination.

  Doubles run out of room after ~50 consecutive splits in the same
  gap. Nothing in a meeting agenda approaches that, but the caller is
  told when a gap has collapsed so it can renumber deliberately
  rather than silently producing two items with the same position.
*/
export const MIN_GAP = 1e-6;

export function positionBetween(before: number | null, after: number | null): number | null {
  if (before === null && after === null) return 1;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  if (after - before < MIN_GAP) return null; // caller must renumber
  return (before + after) / 2;
}

/** Renumber a list to whole numbers, for when a gap has collapsed. */
export function renumber<T>(items: T[]): { item: T; position: number }[] {
  return items.map((item, i) => ({ item, position: i + 1 }));
}

export function titleIssue(v: string): string | null {
  if (!v.trim()) return "Give it a title, so it is recognisable in a list.";
  if (v.length > TITLE_MAX) return `Titles are limited to ${TITLE_MAX} characters.`;
  return null;
}

/*
  Is this a sane time to book?

  Deliberately permissive about the past: a coach logging a session
  that already happened is a real thing to want. What it refuses is
  the shapes that render as nonsense — a meeting that ends before it
  starts, one of zero length, or one so long it swallows a calendar.
*/
export function rangeIssue(startsAt: string, endsAt: string): string | null {
  const a = Date.parse(startsAt);
  const b = Date.parse(endsAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "That is not a valid date and time.";
  if (b <= a) return "The end has to come after the start.";
  if ((b - a) / 60000 > MAX_MINUTES) return `Meetings are capped at ${MAX_MINUTES / 60} hours.`;
  return null;
}

/** Minutes between two ISO timestamps. */
export function minutesBetween(startsAt: string, endsAt: string): number {
  return Math.max(0, Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60000));
}

/*
  When may somebody actually join?

  The room opens ten minutes early — people arrive early and a locked
  door reads as a broken feature — and stays open for fifteen minutes
  past the end so an overrunning session is not cut off mid-sentence.
*/
export const JOIN_OPENS_MIN = 10;
export const JOIN_CLOSES_MIN = 15;

export function joinWindow(startsAt: string, endsAt: string) {
  return {
    opensAt: new Date(Date.parse(startsAt) - JOIN_OPENS_MIN * 60000).toISOString(),
    closesAt: new Date(Date.parse(endsAt) + JOIN_CLOSES_MIN * 60000).toISOString(),
  };
}

export function canJoin(m: Pick<Meeting, "status" | "startsAt" | "endsAt">, now = new Date()): boolean {
  if (m.status !== "confirmed") return false;
  const { opensAt, closesAt } = joinWindow(m.startsAt, m.endsAt);
  const t = now.getTime();
  return t >= Date.parse(opensAt) && t <= Date.parse(closesAt);
}

/**
 * Why the join button is not available, in words worth reading.
 *
 * A disabled button with no explanation is the thing people file
 * support tickets about.
 */
export function joinBlockedReason(
  m: Pick<Meeting, "status" | "startsAt" | "endsAt">,
  now = new Date(),
): string | null {
  if (canJoin(m, now)) return null;
  if (m.status === "proposed") return "Not confirmed yet.";
  if (m.status === "declined") return "This was declined.";
  if (m.status === "cancelled") return "This was cancelled.";
  if (m.status === "done") return "This one is finished.";
  const { opensAt, closesAt } = joinWindow(m.startsAt, m.endsAt);
  if (now.getTime() < Date.parse(opensAt)) return `Opens ${JOIN_OPENS_MIN} minutes before the start.`;
  if (now.getTime() > Date.parse(closesAt)) return "This one has finished.";
  return "Not available.";
}

/*
  The two people are frequently in different countries, so every time
  is rendered in the reader's own zone and the zone is NAMED. "3pm"
  with no zone is how a coach in Manchester and a player in Lagos end
  up on a call an hour apart.
*/
export function formatWhen(iso: string, locale?: string): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatTimeOnly(iso: string, locale?: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** "in 3 days", "in 2 hours", "started 10 minutes ago". */
export function relativeWhen(iso: string, now = new Date()): string {
  const ms = Date.parse(iso) - now.getTime();
  const mins = Math.round(ms / 60000);
  const ago = mins < 0;
  const n = Math.abs(mins);
  const say = (v: number, unit: string) =>
    ago ? `${v} ${unit}${v === 1 ? "" : "s"} ago` : `in ${v} ${unit}${v === 1 ? "" : "s"}`;
  if (n < 1) return ago ? "just now" : "now";
  if (n < 60) return say(n, "minute");
  if (n < 60 * 24) return say(Math.round(n / 60), "hour");
  return say(Math.round(n / (60 * 24)), "day");
}

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  proposed: "Waiting",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  done: "Done",
};
