export type CalendarKind =
  | "match"
  | "team"
  | "individual"
  | "gym"
  | "recovery"
  | "study"
  | "meeting"
  | "rest"
  | "tactical"
  | "conditioning"
  | "film";

export interface CalendarInput {
  kind: CalendarKind;
  title: string;
  startsAt: string; // ISO datetime-local
  endsAt?: string | null;
  mdTag?: string;
}

export interface CalendarEvent extends CalendarInput {
  id: string;
}

export const CALENDAR_KINDS: { kind: CalendarKind; label: string; color: string }[] = [
  { kind: "match", label: "Match", color: "var(--signal)" },
  { kind: "team", label: "Team", color: "var(--info)" },
  { kind: "individual", label: "Individual", color: "var(--signal-bright)" },
  { kind: "tactical", label: "Tactical", color: "var(--review)" },
  { kind: "gym", label: "Gym", color: "var(--text-dim)" },
  { kind: "conditioning", label: "Conditioning", color: "var(--correction)" },
  { kind: "film", label: "Film", color: "#c58bff" },
  { kind: "study", label: "Study", color: "#c58bff" },
  { kind: "recovery", label: "Recovery", color: "var(--positive)" },
  { kind: "meeting", label: "Meeting", color: "var(--text-dim)" },
  { kind: "rest", label: "Rest", color: "var(--positive)" },
];

export function calendarMeta(kind: CalendarKind) {
  return CALENDAR_KINDS.find((k) => k.kind === kind) ?? CALENDAR_KINDS[0];
}
