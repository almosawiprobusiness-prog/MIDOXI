/*
  Recovery — shared shapes. Client-safe.

  MIDO records four things about how a player feels, each 1–5, each typed in by
  the player: energy, soreness, sleep and mental state. That is the whole input.

  It is worth stating plainly because the old Recovery screen showed HRV in
  milliseconds, resting heart rate in bpm, hydration in litres, sleep in decimal
  hours and a six-region soreness map. **None of those exist in the schema and
  none can be entered anywhere in the product.** They were invented numbers on a
  page a player would use to decide whether to train.

  What replaces them is smaller and real: four self-reported scores, a readiness
  figure derived from them by an arithmetic anyone can check, and an explicit
  list of what a wearable would add.
*/

/** The four things a player actually reports, each 1–5. */
export interface Checkin {
  date: string;
  /** 1 = flat, 5 = sharp. */
  energy: number | null;
  /** 1 = fresh, 5 = very sore. Higher is worse. */
  soreness: number | null;
  /** 1 = slept badly, 5 = slept well. */
  sleep: number | null;
  /** 1 = struggling, 5 = switched on. */
  mental: number | null;
  note: string | null;
}

/** A check-in with its derived readiness attached. */
export interface ScoredCheckin extends Checkin {
  /** 0–100, or null when too little was reported to say anything. */
  readiness: number | null;
}

export interface RecoveryView {
  source: "demo" | "yours";
  days: ScoredCheckin[];
  today: ScoredCheckin | null;
  /** How many of the last 7 days were actually checked in. */
  streak: { reported: number; of: number };
}

/**
 * What a wearable would add, named so the page can say what is missing instead
 * of quietly filling it in.
 */
export const NOT_MEASURED = {
  metrics: ["HRV", "Resting heart rate", "Sleep stages", "Hydration", "Blood oxygen"],
  why: "MIDO records how you say you feel. Physiological measures need a wearable or a lab, and MIDO has neither.",
  wouldNeed: "A wearable integration — Whoop, Oura, Garmin or Apple Health.",
} as const;

export const CHECKIN_FIELDS: {
  key: "energy" | "soreness" | "sleep" | "mental";
  label: string;
  /** True when a high number is a bad sign. */
  inverted: boolean;
  low: string;
  high: string;
}[] = [
  { key: "energy", label: "Energy", inverted: false, low: "Flat", high: "Sharp" },
  { key: "sleep", label: "Sleep", inverted: false, low: "Broken", high: "Deep" },
  { key: "soreness", label: "Soreness", inverted: true, low: "Fresh", high: "Very sore" },
  { key: "mental", label: "Head", inverted: false, low: "Struggling", high: "Switched on" },
];

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/**
 * Readiness, 0–100, from the four self-reported scores.
 *
 * This is an average of what the player said, with soreness flipped — nothing
 * cleverer, and deliberately so. A readiness score that came out of a model the
 * player cannot follow would be asking them to trust a number about their own
 * body that they have no way of checking.
 *
 * Fields left blank are left out of the average rather than assumed. Below
 * `MIN_FIELDS` answered, it returns null: three quarters of a picture is a
 * picture, one quarter is a guess.
 */
export const MIN_FIELDS_FOR_READINESS = 2;

export function readinessOf(c: Checkin): number | null {
  const parts: number[] = [];
  if (c.energy != null) parts.push(c.energy);
  if (c.sleep != null) parts.push(c.sleep);
  if (c.mental != null) parts.push(c.mental);
  // Soreness runs the other way: 5 sore is 1 ready.
  if (c.soreness != null) parts.push(6 - c.soreness);

  if (parts.length < MIN_FIELDS_FOR_READINESS) return null;
  const mean = parts.reduce((a, b) => a + b, 0) / parts.length;
  // 1–5 onto 0–100, so a flat 3 across the board reads as 50.
  return Math.round(((mean - 1) / 4) * 100);
}

export function score(c: Checkin): ScoredCheckin {
  return { ...c, readiness: readinessOf(c) };
}

export type ReadinessBand = "primed" | "ready" | "manage" | "unknown";

export function bandOf(readiness: number | null): ReadinessBand {
  if (readiness === null) return "unknown";
  if (readiness >= 75) return "primed";
  if (readiness >= 55) return "ready";
  return "manage";
}

export const BAND_META: Record<
  ReadinessBand,
  { label: string; advice: string; color: string }
> = {
  primed: {
    label: "Primed",
    advice: "You reported feeling good across the board. Full intensity is available.",
    color: "var(--positive)",
  },
  ready: {
    label: "Ready",
    advice: "Fine to train. Watch how the session goes and adjust rather than pushing through.",
    color: "var(--signal)",
  },
  manage: {
    label: "Manage load",
    advice:
      "You reported feeling below your usual. Consider volume over intensity — and tell whoever is running the session.",
    color: "var(--review)",
  },
  unknown: {
    label: "Not reported",
    advice: "Check in and this fills itself. Until then there is nothing to read.",
    color: "var(--text-faint)",
  },
};

/** Days reported out of the last `of` days. */
export function streakOf(
  days: Checkin[],
  of = 7,
  now = new Date(),
): { reported: number; of: number } {
  const cutoff = now.getTime() - of * 864e5;
  return {
    reported: days.filter((d) => new Date(d.date).getTime() >= cutoff).length,
    of,
  };
}
