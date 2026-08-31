import type { PlayerSignals } from "./next-best-action";

/*
  THE CONTEXT SELECTOR — spec step 7, the last piece of the player-side
  event-intelligence spec.

  What MIDO is told about a player when a model IS called. The Next Best
  Action scorer decides what to do WITHOUT a model; this decides what a
  model may know when one runs. Both read the same PlayerSignals — one
  signal pipeline, never two — so what the AI is told can never drift
  from what the deterministic loop believes.

  Two disciplines govern the shape:

  1. BOUNDED. Goals, concepts and studies are capped, and the rendered
     block has a hard character ceiling. A player with a two-year record
     costs the same tokens as a new one. The caps are exported so tests
     pin them rather than re-deriving them.

  2. CITABLE. Everything in the context carries a stable key
     ("goal:<id>", "film:<concept>", "study:<slug>", "readiness",
     "rhythm", "memory").
     A generation that wants to justify itself must cite one of these
     keys, and `validSourceKeys` is the whole universe — anything else
     a model invents is dropped in code, not argued with in a prompt.
*/

export const CONTEXT_MAX_GOALS = 5;
export const CONTEXT_MAX_CONCEPTS = 8;
export const CONTEXT_MAX_STUDIES = 5;

export interface FilmConceptSummary {
  concept: string;
  /** How many observations of this concept in the window. */
  count: number;
  /** Days since the most recent one. */
  lastDaysAgo: number;
  /** Goal ids this concept's observations were linked to. */
  goalIds: string[];
}

export interface PlayerContext {
  /** Where the player is in their week. All values may be null = unknown. */
  situation: {
    daysSinceLastMatch: number | null;
    lastMatchReviewed: boolean;
    daysUntilNextMatch: number | null;
    readiness: number | null;
    daysSinceTraining: number | null;
    daysSinceStudy: number | null;
  };
  /** Active development goals, capped, most important first. */
  goals: { id: string; title: string }[];
  /**
   * What the film actually showed, aggregated by concept — most
   * observed first, so "the thing that keeps appearing" leads.
   */
  filmConcepts: FilmConceptSummary[];
  /** Recently completed studies, newest first, capped. */
  studies: { subject: string; daysAgo: number }[];
  /**
   * The player's standing memory, already rendered by
   * `memoryPromptBlock`. Null when there is none.
   */
  memoryBlock: string | null;
  /**
   * One saved Capture moment the session was asked to be built around
   * ("Build a training session" from the extension). Loaded on demand
   * by the engine when the brief's focusKey is `capture:<id>` — never
   * part of the default context, so ordinary drafts pay nothing for it.
   * The observation is the PLAYER'S OWN note, not an AI analysis, and
   * the prompt block says so.
   */
  captureLesson?: CaptureLesson;
}

export interface CaptureLesson {
  id: string;
  videoTitle: string;
  /** Capture category enum value, or null. */
  category: string | null;
  /** The player's own words, bounded before prompting. */
  observation: string;
  goalId: string | null;
}

/** Bound on the lesson text as rendered into a prompt. */
export const CAPTURE_LESSON_MAX_CHARS = 400;

/** A saved capture's citation key. */
export function captureKey(id: string): string {
  return `capture:${id}`;
}

/**
 * Select the bounded context from the same signals the scorer reads.
 * Pure so the aggregation is testable by stating a situation.
 */
export function selectPlayerContext(
  signals: PlayerSignals,
  memoryBlock: string | null,
): PlayerContext {
  const byConcept = new Map<string, FilmConceptSummary>();
  for (const o of signals.filmObservations ?? []) {
    const existing = byConcept.get(o.concept);
    if (existing) {
      existing.count += 1;
      existing.lastDaysAgo = Math.min(existing.lastDaysAgo, o.daysAgo);
      if (o.goalId && !existing.goalIds.includes(o.goalId)) existing.goalIds.push(o.goalId);
    } else {
      byConcept.set(o.concept, {
        concept: o.concept,
        count: 1,
        lastDaysAgo: o.daysAgo,
        goalIds: o.goalId ? [o.goalId] : [],
      });
    }
  }

  const filmConcepts = [...byConcept.values()]
    .sort((a, b) => b.count - a.count || a.lastDaysAgo - b.lastDaysAgo)
    .slice(0, CONTEXT_MAX_CONCEPTS);

  return {
    situation: {
      daysSinceLastMatch: signals.daysSinceLastMatch,
      lastMatchReviewed: signals.lastMatchReviewed,
      daysUntilNextMatch: signals.daysUntilNextMatch,
      readiness: signals.readiness,
      daysSinceTraining: signals.daysSinceTraining,
      daysSinceStudy: signals.daysSinceStudy,
    },
    goals: signals.activeGoals.slice(0, CONTEXT_MAX_GOALS),
    filmConcepts,
    studies: (signals.completedStudies ?? []).slice(0, CONTEXT_MAX_STUDIES),
    memoryBlock: memoryBlock && memoryBlock.trim().length ? memoryBlock : null,
  };
}

/**
 * A completed study's citation key. Studies arrive as display subjects
 * ("Harry Kane"), so the key is a slug of the subject — stable for the
 * same study, safe inside a bracketed tag.
 */
export function studyKey(subject: string): string {
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `study:${slug || "unknown"}`;
}

/**
 * Every key a generation may cite. The validator treats this as the
 * whole universe: a source outside it did not come from the record.
 */
export function validSourceKeys(ctx: PlayerContext): Set<string> {
  const keys = new Set<string>(["rhythm"]);
  if (ctx.situation.readiness !== null) keys.add("readiness");
  if (ctx.memoryBlock) keys.add("memory");
  for (const g of ctx.goals) keys.add(`goal:${g.id}`);
  for (const c of ctx.filmConcepts) keys.add(`film:${c.concept}`);
  for (const st of ctx.studies) keys.add(studyKey(st.subject));
  if (ctx.captureLesson) keys.add(captureKey(ctx.captureLesson.id));
  return keys;
}

/** Hard ceiling on the rendered block, so a prompt cannot quietly grow. */
export const CONTEXT_BLOCK_MAX_CHARS = 2400;

/**
 * Render the context as the prompt block a model receives.
 *
 * Facts only, in plain lines. Never adjectives, never conclusions —
 * drawing conclusions is the model's job and stating facts is ours,
 * and mixing the two is how a context block becomes a leading question.
 */
export function contextPromptBlock(ctx: PlayerContext): string {
  const lines: string[] = ["PLAYER RECORD (from the product's own log — cite by key):"];

  /*
    The saved lesson leads when there is one — the session was asked to
    be built around it, and being first means the 2400-char ceiling can
    never silently drop it. Stated as what it is: the player's own
    noticing, never "analysis" — no model has watched this footage.
  */
  if (ctx.captureLesson) {
    const c = ctx.captureLesson;
    const note = c.observation.slice(0, CAPTURE_LESSON_MAX_CHARS);
    lines.push(
      `- [${captureKey(c.id)}] Saved lesson — the player's OWN observation while watching "${c.videoTitle.slice(0, 120)}"${c.category ? ` (${c.category})` : ""}: "${note}". This is what they noticed, not an AI analysis.`,
    );
  }

  const s = ctx.situation;
  if (s.daysSinceLastMatch !== null) {
    lines.push(
      `- [rhythm] Last match: ${s.daysSinceLastMatch} day(s) ago${s.lastMatchReviewed ? "" : ", not yet reviewed"}.`,
    );
  }
  if (s.daysUntilNextMatch !== null) lines.push(`- [rhythm] Next match: in ${s.daysUntilNextMatch} day(s).`);
  if (s.daysSinceTraining !== null) lines.push(`- [rhythm] Last training: ${s.daysSinceTraining} day(s) ago.`);
  if (s.daysSinceStudy !== null) lines.push(`- [rhythm] Last study: ${s.daysSinceStudy} day(s) ago.`);
  if (s.readiness !== null) lines.push(`- [readiness] Readiness ${s.readiness}/100 at the last check-in.`);

  for (const g of ctx.goals) lines.push(`- [goal:${g.id}] Active goal: ${g.title}`);

  for (const c of ctx.filmConcepts) {
    const linked = c.goalIds.length ? " (linked to a goal above)" : "";
    lines.push(
      `- [film:${c.concept}] Film showed "${c.concept}" ${c.count} time(s), most recently ${c.lastDaysAgo} day(s) ago${linked}.`,
    );
  }

  /*
    Studies used to ride under [rhythm], which made "apply what you
    studied" uncitable — a session block built on the Kane study had no
    key to name. Each completed study is now its own evidence line.
  */
  for (const st of ctx.studies) {
    lines.push(`- [${studyKey(st.subject)}] Studied "${st.subject}" ${st.daysAgo} day(s) ago.`);
  }

  let block = lines.join("\n");
  if (ctx.memoryBlock) block += `\n\n${ctx.memoryBlock}`;

  return block.length > CONTEXT_BLOCK_MAX_CHARS ? block.slice(0, CONTEXT_BLOCK_MAX_CHARS) : block;
}
