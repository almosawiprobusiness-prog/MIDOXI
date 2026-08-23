/*
  What ninety seconds of talking turns into.

  Client-safe: the shape, and the pure functions that decide what to show the
  player before anything is saved.

  Every field is nullable, and that is the whole design. A voice note is
  incomplete by nature — people say the score and forget the competition, or
  mention the opponent and never the date. The alternative to null is a
  plausible default, and a plausible default is a fact nobody stated sitting in
  a report six months later.
*/

export interface VoiceDraft {
  /** Verbatim, so the player can see what MIDO heard. */
  transcript: string;
  opponent: string | null;
  competition: string | null;
  /** YYYY-MM-DD. Falls back to today, never to a future date. */
  playedAt: string;
  home: boolean | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  position: string | null;
  started: boolean | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  rating: number | null;
  /** Anything said that is not a field — kept in their own words. */
  notes: string | null;
}

/** The fields the form needs before a match can be saved at all. */
export const REQUIRED_FIELDS = ["opponent"] as const;

export interface DraftField {
  key: keyof VoiceDraft;
  label: string;
  /** True when MIDO did not hear it, so the UI can say so rather than imply zero. */
  missing: boolean;
  display: string;
}

const LABELS: Partial<Record<keyof VoiceDraft, string>> = {
  opponent: "Opponent",
  competition: "Competition",
  playedAt: "Date",
  home: "Home or away",
  goalsFor: "Goals for",
  goalsAgainst: "Goals against",
  position: "Position",
  started: "Started",
  minutes: "Minutes",
  goals: "Goals",
  assists: "Assists",
  rating: "Rating",
};

/**
 * What MIDO heard, and what it did not.
 *
 * Shown as two lists rather than a form full of blanks, because "MIDO did not
 * hear this" and "this is zero" look identical in an empty number input and
 * mean completely different things.
 */
export function readDraft(draft: VoiceDraft): { heard: DraftField[]; missed: DraftField[] } {
  const heard: DraftField[] = [];
  const missed: DraftField[] = [];

  for (const key of Object.keys(LABELS) as (keyof VoiceDraft)[]) {
    const value = draft[key];
    const label = LABELS[key]!;
    const missing = value === null || value === undefined || value === "";

    const field: DraftField = { key, label, missing, display: display(key, value) };
    (missing ? missed : heard).push(field);
  }
  return { heard, missed };
}

function display(key: keyof VoiceDraft, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "home") return value ? "Home" : "Away";
  if (key === "started") return value ? "Started" : "Off the bench";
  if (key === "playedAt") {
    const d = new Date(`${String(value)}T12:00:00`);
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }
  return String(value);
}

/** Can this be saved yet? Only the opponent is genuinely required. */
export function draftIssue(draft: VoiceDraft): string | null {
  if (!draft.opponent?.trim()) {
    return "MIDO did not catch who you played. Add the opponent and you can save it.";
  }
  return null;
}

/**
 * A one-line summary of what was understood, for the confirm button.
 *
 * Counts fields rather than claiming success, because "MIDO filled in 9 of 12"
 * is checkable and "got it!" is not.
 */
export function draftSummary(draft: VoiceDraft): string {
  const { heard, missed } = readDraft(draft);
  const total = heard.length + missed.length;
  if (missed.length === 0) return `All ${total} fields heard.`;
  return `${heard.length} of ${total} fields heard — the rest are blank for you to fill in or leave.`;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/** Anything past this is a monologue, not a match report. */
export const MAX_RECORDING_SECONDS = 120;
/** Below this nobody has said anything worth sending. */
export const MIN_RECORDING_SECONDS = 3;

/**
 * The container to record in.
 *
 * All four of these were tested against the speech model and accepted, so the
 * choice is purely what the browser will give us. Ogg/Opus first because it is
 * the smallest for speech; MP4 last because Safari is the only one that needs it.
 */
export const PREFERRED_AUDIO_TYPES = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

export function pickAudioType(isSupported: (t: string) => boolean): string | null {
  return PREFERRED_AUDIO_TYPES.find(isSupported) ?? null;
}

export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
