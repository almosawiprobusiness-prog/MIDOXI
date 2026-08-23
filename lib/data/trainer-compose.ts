import {
  matchQualities,
  quality,
  testsForQuality,
  type PhysicalQuality,
  type QualitySlug,
} from "@/lib/knowledge/physical";
import type { ExerciseSlot, SessionIntent } from "./trainer-types";

/*
  Deterministic program composition.

  The free, always-available half of the trainer engine. A block is built from
  curated qualities — real exercises, real prescriptions, real progression
  rules — and waved across the weeks so it reads like programming rather than
  the same session repeated N times.

  No server imports and no model calls, so this is unit testable and runs
  identically whether or not Claude is reachable.
*/

export interface ProgramContext {
  objective: string;
  weeks: number;
  sessionsPerWeek: number;
  /** Anything a session must respect, in the trainer's own words. */
  limitations: string;
  /** The athlete's football position, when known. */
  position: string;
}

export interface ComposedExercise {
  name: string;
  prescription: string;
  cue: string;
  slot: ExerciseSlot;
}

export interface ComposedSession {
  week: number;
  day: number;
  title: string;
  focus: string;
  intent: SessionIntent | null;
  exercises: ComposedExercise[];
}

export interface ComposedProgram {
  qualities: QualitySlug[];
  sessions: ComposedSession[];
  source: "mido" | "library";
  note: string | null;
}

/**
 * The intent of each week: three weeks of build, a deload every fourth, and
 * the final week always a retest — a block that is never retested cannot be
 * shown to have worked.
 */
export function weekIntent(week: number, weeks: number): SessionIntent {
  if (week === weeks) return "test";
  if (week % 4 === 0) return "deload";
  return "build";
}

const STRENGTH_LIFT = /squat|deadlift|press|lunge|rdl/i;

/** Percentage prescription for the week's main lift. */
function strengthLoad(intent: SessionIntent, week: number): string {
  if (intent === "deload") return "3 x 3 @ 60-65% · three reps in reserve";
  if (intent === "test") return "Retest — fresh athlete, full recovery between attempts";
  const pct = Math.min(88, 74 + week * 2);
  return `4 x ${week >= 4 ? 3 : 5} @ ${pct}% · 3 min rest`;
}

/**
 * Wave a curated prescription across the block. Build weeks add a set, deload
 * weeks cut volume, and a retest week replaces the work with the test itself.
 * Prescriptions that do not start with a set count are annotated instead of
 * being rewritten, so nothing curated is mangled.
 */
export function waved(prescription: string, intent: SessionIntent, week: number): string {
  if (intent === "test") return "Retest — full recovery between attempts";

  const match = prescription.match(/^(\d+)\s*(x|×)\s*/i);
  if (!match) {
    if (intent === "deload") return `${prescription} · volume cut by a third`;
    return week > 1 ? `${prescription} · week ${week} intent: quality over volume` : prescription;
  }

  const base = Number(match[1]);
  const rest = prescription.slice(match[0].length);
  const sets =
    intent === "deload"
      ? Math.max(2, Math.round(base * 0.6))
      : base + Math.min(3, Math.max(0, week - 1));

  return `${sets} x ${rest}${intent === "deload" ? " · deload" : ""}`;
}

/**
 * A retest session is the tests themselves, with their curated protocols — not
 * the training exercises with "retest" written next to them.
 */
function testSession(qualities: PhysicalQuality[], limitations: string): ComposedExercise[] {
  const seen = new Set<string>();
  const out: ComposedExercise[] = [];

  if (limitations.trim()) {
    out.push({
      name: "Limitation check",
      prescription: "Before testing",
      cue: `Recorded limitation: ${limitations.trim()} — do not test through it.`,
      slot: "prep",
    });
  }
  out.push({
    name: "Standardised warm-up",
    prescription: "10-12 min · identical to the baseline session",
    cue: "A retest is only comparable if the preparation was the same",
    slot: "prep",
  });

  for (const q of qualities) {
    for (const t of testsForQuality(q.slug)) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push({ name: t.label, prescription: t.protocol, cue: t.tells, slot: "primary" });
    }
  }
  return out.slice(0, 8);
}

function sessionExercises(
  qualities: PhysicalQuality[],
  day: number,
  lastDay: number,
  intent: SessionIntent,
  week: number,
  limitations: string,
): ComposedExercise[] {
  const lead = qualities[(day - 1) % qualities.length] ?? qualities[0];
  const others = qualities.filter((q) => q.slug !== lead.slug);
  const out: ComposedExercise[] = [];
  const seen = new Set<string>();

  const push = (
    e: { name: string; prescription: string; cue: string } | undefined,
    slot: ExerciseSlot,
  ) => {
    if (!e || seen.has(e.name)) return;
    seen.add(e.name);
    // The week's wave shows on the main lift; accessories keep their own rep range.
    const isMainLift = STRENGTH_LIFT.test(e.name) && (slot === "primary" || slot === "secondary");
    out.push({
      name: e.name,
      prescription: isMainLift ? strengthLoad(intent, week) : waved(e.prescription, intent, week),
      cue: e.cue,
      slot,
    });
  };

  const from = (q: PhysicalQuality | undefined, slot: ExerciseSlot) =>
    q?.exercises.filter((e) => e.slot === slot) ?? [];

  // Prep: one from the lead quality, or a mobility opener from anywhere.
  push(from(lead, "prep")[0] ?? others.flatMap((q) => from(q, "prep"))[0], "prep");

  // The main work is whatever actually develops today's quality — for a
  // conditioning quality that IS the conditioning, not a barbell lift.
  const leadWork = [...from(lead, "primary"), ...from(lead, "conditioning"), ...from(lead, "secondary")];
  leadWork.slice(0, 2).forEach((e) => push(e, e.slot as ExerciseSlot));

  // Secondary: the lead's own, or a primary borrowed from another quality.
  push(
    from(lead, "secondary")[0] ?? others.flatMap((q) => from(q, "secondary").concat(from(q, "primary")))[0],
    "secondary",
  );

  // Accessory: one from the lead, one from elsewhere — the resilience work.
  push(from(lead, "accessory")[0], "accessory");
  push(others.flatMap((q) => from(q, "accessory"))[0], "accessory");

  // Conditioning closes the last session of the week, from whichever selected
  // quality actually has conditioning work.
  if (day === lastDay && intent !== "test") {
    push(qualities.flatMap((q) => from(q, "conditioning"))[0], "conditioning");
  }

  // Never send a trainer a session with one item in it.
  if (out.filter((e) => e.slot !== "prep").length < 3) {
    for (const q of qualities) {
      for (const e of q.exercises) {
        if (out.filter((x) => x.slot !== "prep").length >= 4) break;
        push(e, e.slot as ExerciseSlot);
      }
    }
  }

  if (limitations.trim()) {
    out.unshift({
      name: "Limitation check",
      prescription: "Before the session",
      cue: `Recorded limitation: ${limitations.trim()}`,
      slot: "prep",
    });
  }

  return out;
}

/** Build the whole block: qualities, weeks, sessions and prescriptions. */
export function composeProgram(ctx: ProgramContext): ComposedProgram {
  const weeks = Math.max(1, Math.min(24, ctx.weeks));
  const perWeek = Math.max(1, Math.min(7, ctx.sessionsPerWeek));
  const qualities = matchQualities(ctx.objective, perWeek >= 3 ? 3 : 2);
  const sessions: ComposedSession[] = [];

  for (let week = 1; week <= weeks; week++) {
    const intent = weekIntent(week, weeks);
    for (let day = 1; day <= perWeek; day++) {
      const lead = qualities[(day - 1) % qualities.length] ?? qualities[0];
      sessions.push({
        week,
        day,
        title:
          intent === "test" ? `Week ${week} · Retest` : `Week ${week} · ${lead ? lead.name : "Session"}`,
        focus:
          intent === "test"
            ? `Retest ${qualities.map((q) => q.name.toLowerCase()).join(" and ")} — the athlete must be fresh.`
            : intent === "deload"
              ? `${lead ? lead.why : ctx.objective} Volume is cut this week so the adaptation shows.`
              : lead
                ? lead.why
                : ctx.objective,
        intent,
        exercises:
          intent === "test"
            ? testSession(qualities, ctx.limitations)
            : sessionExercises(qualities, day, perWeek, intent, week, ctx.limitations),
      });
    }
  }

  return {
    qualities: qualities.map((q) => q.slug),
    sessions,
    source: "library",
    note: null,
  };
}

/** The progression and regression rules behind a composed block, for the UI. */
export function programRules(qualities: QualitySlug[]): {
  quality: string;
  progression: string[];
  regression: string[];
  weeklyDose: string;
}[] {
  return qualities
    .map((slug) => quality(slug))
    .filter((q): q is PhysicalQuality => Boolean(q))
    .map((q) => ({
      quality: q.name,
      progression: q.progression,
      regression: q.regression,
      weeklyDose: q.weeklyDose,
    }));
}
