/*
  The event vocabulary.

  Client-safe and dependency-free: the emitter validates against this,
  the recommendation engine reads it, and the tests pin it. One authority
  for what MIDO considers worth remembering.

  THE ADMISSION RULE, which is the whole reason this file is short:

    An event earns its place only if a row of it could change what MIDO
    says or recommends later.

  `MATCH_REVIEWED` changes things — it means the review question has been
  answered and the next recommendation should move on. `PAGE_OPENED`
  changes nothing; it is analytics, which is a different system with
  different retention, different privacy and no business in the football
  record. Twenty-odd types is a vocabulary. Two hundred is a log file.
*/

export type MidoEventType =
  // ── the player development loop ──
  | "PLAYER_CHECKIN_COMPLETED"
  | "GOAL_CREATED"
  | "GOAL_UPDATED"
  | "GOAL_COMPLETED"
  | "MATCH_CREATED"
  | "MATCH_REVIEWED"
  | "VIDEO_UPLOADED"
  | "VIDEO_ANALYZED"
  | "FILM_OBSERVATION_CREATED"
  | "STUDY_STARTED"
  | "STUDY_COMPLETED"
  | "TRAINING_LOGGED"
  | "RECOVERY_LOGGED"
  // ── coach / trainer / club, emitted but not yet consumed ──
  | "SESSION_ASSIGNED"
  | "SESSION_COMPLETED"
  | "ASSESSMENT_RECORDED"
  | "METHODOLOGY_UPDATED"
  | "COACH_FEEDBACK_ADDED"
  // ── MIDO's own actions, so a recommendation can be followed up ──
  | "MIDO_RECOMMENDATION_CREATED"
  | "MIDO_RECOMMENDATION_COMPLETED"
  | "MIDO_RECOMMENDATION_DISMISSED";

export type SubjectType =
  | "player"
  | "coach"
  | "trainer"
  | "club"
  | "team"
  | "match"
  | "session"
  | "video"
  | "study"
  | "goal"
  | "assessment"
  | "recommendation"
  | "checkin"
  | "training";

/**
 * Who or what caused it.
 *
 * Kept because provenance is a trust question, not a bookkeeping one: a
 * player must be able to see that an observation came from `ai` rather
 * than from their coach, and MIDO must never present the first as the
 * second.
 */
export type EventSource = "user" | "coach" | "trainer" | "club" | "ai" | "system";

export interface MidoEvent {
  id: string;
  type: MidoEventType;
  actorUserId: string | null;
  subjectType: SubjectType;
  subjectId: string | null;
  organizationId?: string | null;
  teamId?: string | null;
  source: EventSource;
  payload: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
  version: number;
}

export interface EmitInput {
  type: MidoEventType;
  subjectType: SubjectType;
  subjectId?: string | null;
  source?: EventSource;
  /**
   * Event-specific context ONLY.
   *
   * If a value can be read from the domain table via `subjectId`, it does
   * not belong here. The event log records what happened; the domain
   * stays authoritative for what exists. Ignoring this is how an event
   * log becomes a second, slowly-diverging copy of the database.
   */
  payload?: Record<string, unknown>;
  /** When it actually happened, if that is not now. */
  occurredAt?: string | Date;
  organizationId?: string | null;
  teamId?: string | null;
  /**
   * Makes a repeat emit a no-op.
   *
   * A server action can be retried, double-submitted, or replayed by a
   * router refresh. Without this a single match review becomes three
   * events and every "has this been done?" check silently triples.
   */
  idempotencyKey?: string;
}

/**
 * What each event is allowed to be about.
 *
 * A `GOAL_CREATED` whose subject is a match is a bug in the caller, and
 * one that reaches storage is a bug that quietly poisons every later
 * query. Checked at emit rather than trusted.
 */
export const EVENT_SUBJECT: Record<MidoEventType, SubjectType> = {
  PLAYER_CHECKIN_COMPLETED: "checkin",
  GOAL_CREATED: "goal",
  GOAL_UPDATED: "goal",
  GOAL_COMPLETED: "goal",
  MATCH_CREATED: "match",
  MATCH_REVIEWED: "match",
  VIDEO_UPLOADED: "video",
  VIDEO_ANALYZED: "video",
  FILM_OBSERVATION_CREATED: "video",
  STUDY_STARTED: "study",
  STUDY_COMPLETED: "study",
  TRAINING_LOGGED: "training",
  RECOVERY_LOGGED: "checkin",
  SESSION_ASSIGNED: "session",
  SESSION_COMPLETED: "session",
  ASSESSMENT_RECORDED: "assessment",
  METHODOLOGY_UPDATED: "club",
  COACH_FEEDBACK_ADDED: "player",
  MIDO_RECOMMENDATION_CREATED: "recommendation",
  MIDO_RECOMMENDATION_COMPLETED: "recommendation",
  MIDO_RECOMMENDATION_DISMISSED: "recommendation",
};

export const EVENT_TYPES = Object.keys(EVENT_SUBJECT) as MidoEventType[];

export function isEventType(v: unknown): v is MidoEventType {
  return typeof v === "string" && v in EVENT_SUBJECT;
}

/** Payloads are capped: an event carrying a whole match is a copy of it. */
export const PAYLOAD_MAX_BYTES = 4_000;

export interface EmitProblem {
  ok: false;
  reason: string;
}

/**
 * Is this emit well-formed?
 *
 * Separated from the emitter so it can be tested without a database, and
 * so the rules are readable in one place rather than spread through
 * insert code.
 */
export function emitIssue(input: EmitInput): string | null {
  if (!isEventType(input.type)) return `Unknown event type: ${String(input.type)}`;

  const expected = EVENT_SUBJECT[input.type];
  if (input.subjectType !== expected) {
    return `${input.type} is about a ${expected}, not a ${input.subjectType}`;
  }

  if (input.payload) {
    const size = JSON.stringify(input.payload).length;
    if (size > PAYLOAD_MAX_BYTES) {
      return `Payload is ${size} bytes and the limit is ${PAYLOAD_MAX_BYTES}. An event references the domain rather than copying it.`;
    }
  }

  if (input.occurredAt) {
    const t = new Date(input.occurredAt).getTime();
    if (!Number.isFinite(t)) return "occurredAt is not a date";
  }

  return null;
}

/** Stable key for "this exact thing, once". */
export function idempotencyKey(parts: (string | number | null | undefined)[]): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== "").join(":");
}
