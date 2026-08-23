import type { QualitySlug } from "@/lib/knowledge/physical";

/*
  Trainer OS — shared shapes. Client-safe: types, constants and pure helpers.
*/

// ── athletes ─────────────────────────────────────────────────

export type AthleteStatus = "active" | "paused" | "archived";

export interface Athlete {
  id: string;
  name: string;
  position: string;
  dateOfBirth: string | null;
  /** The football objective the physical work serves. */
  objective: string | null;
  limitations: string | null;
  status: AthleteStatus;
  /** True when the athlete has their own MIDO XI account linked. */
  linked: boolean;
  /** What a linked athlete has chosen to share. Null when not linked. */
  shareScope: "identity" | "development" | "full" | null;
  /**
   * Latest readiness 0-100, computed from the athlete's own check-in. Only ever
   * present for a linked athlete sharing at the "full" level — never estimated.
   */
  readiness: number | null;
  createdAt: string;
}

export interface AthleteInput {
  name: string;
  position: string;
  dateOfBirth: string;
  objective: string;
  limitations: string;
  status: AthleteStatus;
}

export const ATHLETE_STATUS: { value: AthleteStatus; label: string; color: string }[] = [
  { value: "active", label: "Active", color: "var(--positive)" },
  { value: "paused", label: "Paused", color: "var(--review)" },
  { value: "archived", label: "Archived", color: "var(--text-faint)" },
];

export function athleteStatusMeta(status: AthleteStatus) {
  return ATHLETE_STATUS.find((s) => s.value === status) ?? ATHLETE_STATUS[0];
}

export type AthleteNoteKind = "objective" | "limitation" | "flag" | "session" | "note";

export interface AthleteNote {
  id: string;
  athleteId: string;
  kind: AthleteNoteKind;
  body: string;
  createdAt: string;
}

export const ATHLETE_NOTE_KINDS: { kind: AthleteNoteKind; label: string; color: string }[] = [
  { kind: "objective", label: "Objective", color: "var(--signal-bright)" },
  { kind: "limitation", label: "Limitation", color: "var(--correction)" },
  { kind: "flag", label: "Flag", color: "var(--review)" },
  { kind: "session", label: "Session note", color: "var(--positive)" },
  { kind: "note", label: "Note", color: "var(--text-dim)" },
];

export function athleteNoteMeta(kind: AthleteNoteKind) {
  return ATHLETE_NOTE_KINDS.find((n) => n.kind === kind) ?? ATHLETE_NOTE_KINDS[4];
}

// ── programs ─────────────────────────────────────────────────

export type ProgramStatus = "draft" | "active" | "completed" | "paused";
export type ProgramSource = "trainer" | "mido" | "library";
export type SessionIntent = "build" | "hold" | "deload" | "test";
export type ExerciseSlot = "prep" | "primary" | "secondary" | "accessory" | "conditioning" | "recovery";

export const SESSION_INTENTS: { intent: SessionIntent; label: string; color: string; hint: string }[] = [
  { intent: "build", label: "Build", color: "var(--signal-bright)", hint: "Adding load or intensity" },
  { intent: "hold", label: "Hold", color: "var(--info)", hint: "Maintaining, not adding" },
  { intent: "deload", label: "Deload", color: "var(--positive)", hint: "Volume cut so the adaptation shows" },
  { intent: "test", label: "Test", color: "var(--review)", hint: "Retest week — athlete must be fresh" },
];

export function intentMeta(intent: SessionIntent | null) {
  return SESSION_INTENTS.find((i) => i.intent === intent) ?? SESSION_INTENTS[1];
}

export const EXERCISE_SLOTS: { slot: ExerciseSlot; label: string; color: string }[] = [
  { slot: "prep", label: "Prep", color: "var(--positive)" },
  { slot: "primary", label: "Primary", color: "var(--signal-bright)" },
  { slot: "secondary", label: "Secondary", color: "var(--info)" },
  { slot: "accessory", label: "Accessory", color: "#c58bff" },
  { slot: "conditioning", label: "Conditioning", color: "var(--correction)" },
  { slot: "recovery", label: "Recovery", color: "var(--text-dim)" },
];

export function slotMeta(slot: ExerciseSlot) {
  return EXERCISE_SLOTS.find((s) => s.slot === slot) ?? EXERCISE_SLOTS[1];
}

export interface ProgramExerciseRow {
  id: string;
  name: string;
  prescription: string;
  cue: string;
  slot: ExerciseSlot;
  position: number;
}

export interface ProgramSessionRow {
  id: string;
  week: number;
  day: number;
  title: string;
  focus: string;
  intent: SessionIntent | null;
  notes: string;
  completedAt: string | null;
  position: number;
  exercises: ProgramExerciseRow[];
}

export interface Program {
  id: string;
  athleteId: string | null;
  title: string;
  objective: string;
  qualities: QualitySlug[];
  weeks: number;
  sessionsPerWeek: number;
  startsOn: string | null;
  status: ProgramStatus;
  source: ProgramSource;
  notes: string;
  createdAt: string;
}

export interface ProgramInput {
  athleteId: string | null;
  title: string;
  objective: string;
  weeks: number;
  sessionsPerWeek: number;
  startsOn: string;
  status: ProgramStatus;
}

export interface ProgramDetail {
  program: Program;
  sessions: ProgramSessionRow[];
}

export const PROGRAM_STATUS: { value: ProgramStatus; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "var(--text-dim)" },
  { value: "active", label: "Active", color: "var(--signal-bright)" },
  { value: "paused", label: "Paused", color: "var(--review)" },
  { value: "completed", label: "Completed", color: "var(--positive)" },
];

export function programStatusMeta(status: ProgramStatus) {
  return PROGRAM_STATUS.find((s) => s.value === status) ?? PROGRAM_STATUS[0];
}

/** Sessions grouped by week, in order. */
export function byWeek(sessions: ProgramSessionRow[]): { week: number; sessions: ProgramSessionRow[] }[] {
  const weeks = new Map<number, ProgramSessionRow[]>();
  for (const s of sessions) {
    const list = weeks.get(s.week) ?? [];
    list.push(s);
    weeks.set(s.week, list);
  }
  return [...weeks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, list]) => ({ week, sessions: list.sort((a, b) => a.day - b.day || a.position - b.position) }));
}

// ── assessments ──────────────────────────────────────────────

export interface Assessment {
  id: string;
  athleteId: string;
  test: string;
  value: number;
  unit: string;
  side: "left" | "right" | null;
  testedOn: string;
  notes: string;
  createdAt: string;
}

export interface AssessmentInput {
  athleteId: string;
  test: string;
  value: number;
  unit: string;
  side: "left" | "right" | null;
  testedOn: string;
  notes: string;
}

export interface TestSeries {
  test: string;
  label: string;
  unit: string;
  better: "lower" | "higher";
  entries: Assessment[];
  first: Assessment;
  latest: Assessment;
  /** Signed percentage change from first to latest, in the improving direction. */
  changePct: number;
  improved: boolean;
}

/** Build a per-test series with an honest change figure. */
export function buildSeries(
  entries: Assessment[],
  meta: { label: string; unit: string; better: "lower" | "higher" },
  test: string,
): TestSeries | null {
  const sorted = entries
    .filter((e) => e.test === test)
    .sort((a, b) => a.testedOn.localeCompare(b.testedOn));
  if (sorted.length === 0) return null;

  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const raw = first.value === 0 ? 0 : ((latest.value - first.value) / Math.abs(first.value)) * 100;
  // A lower-is-better test improves when the raw change is negative.
  const changePct = meta.better === "lower" ? -raw : raw;

  return {
    test,
    label: meta.label,
    unit: meta.unit,
    better: meta.better,
    entries: sorted,
    first,
    latest,
    changePct: Number(changePct.toFixed(1)),
    improved: changePct > 0,
  };
}

/** Weeks since a date, or null when there is no date. */
export function weeksSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (7 * 864e5));
}

export interface RetestDue {
  athleteId: string;
  athleteName: string;
  test: string;
  label: string;
  /** Null when the test has never been recorded for this athlete. */
  weeksSince: number | null;
  retestWeeks: number;
}
