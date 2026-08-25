import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import {
  emitIssue,
  EVENT_SUBJECT,
  type EmitInput,
  type MidoEvent,
  type MidoEventType,
} from "./types";

/*
  The one way anything in MIDO says "this happened".

  Every domain uses this primitive. The alternative — a raw insert in each
  of thirty-five server actions — is how an event log acquires thirty-five
  slightly different shapes and stops being queryable.

  ───────────────────────────────────────────────────────────────────────
  FAILURE BEHAVIOUR — the decision this file exists to make
  ───────────────────────────────────────────────────────────────────────

  RECORDING AN EVENT MUST NEVER FAIL THE THING THAT CAUSED IT.

  A player logs a match. The insert into `mido_events` fails — the
  migration has not been run, the column drifted, the network blipped.
  The question is what the player sees.

  The answer is: their match, saved. Not an error. Not a lost form.

  The event log is SECONDARY infrastructure. It makes later work smarter;
  it is not what the user came to do. Taking the primary action down with
  it would trade the thing people need for the thing that helps them, and
  would do it at exactly the moment the system is already unhealthy.

  So `emit` never throws and never rejects. It returns a result that
  callers are free to ignore, and does ignore its own failures beyond
  logging them. That is a deliberate asymmetry, not an oversight:

    · a MISSING event costs a worse recommendation later
    · a FAILED user action costs the user their work now

  The cost of missing events is real, which is why they are logged and
  why the observability tooling exists. It is simply not as expensive as
  the alternative.

  This also means callers must NOT await emit inside a transaction and
  roll back on its result. There is nothing to roll back on.
*/

export type EmitResult =
  | { ok: true; id: string; deduped?: boolean }
  | { ok: false; reason: string };

/** Demo mode keeps events in memory so the loop is testable with no keys. */
interface DemoDB {
  events: MidoEvent[];
  seq: number;
}
const g = globalThis as unknown as { __midoEventDB?: DemoDB };
const demoDB: DemoDB = (g.__midoEventDB ??= { events: [], seq: 1 });

function rowTo(r: Record<string, unknown>): MidoEvent {
  return {
    id: r.id as string,
    type: r.type as MidoEventType,
    actorUserId: (r.actor_user_id as string) ?? null,
    subjectType: r.subject_type as MidoEvent["subjectType"],
    subjectId: (r.subject_id as string) ?? null,
    organizationId: (r.organization_id as string) ?? null,
    teamId: (r.team_id as string) ?? null,
    source: (r.source as MidoEvent["source"]) ?? "user",
    payload: (r.payload as Record<string, unknown>) ?? {},
    occurredAt: (r.occurred_at as string) ?? new Date().toISOString(),
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
    version: Number(r.version ?? 1),
  };
}

/**
 * Record that something happened.
 *
 * Never throws. Safe to call from any server action without a try/catch
 * and without awaiting its result if the caller does not care.
 */
export async function emitMidoEvent(input: EmitInput): Promise<EmitResult> {
  try {
    const issue = emitIssue(input);
    if (issue) {
      /*
        A malformed event is a bug in the CALLER, and it is reported
        loudly rather than stored. Storing it would put a row into the
        log that every later query has to defend against.
      */
      console.error(`[mido-events] refused: ${issue}`, { type: input.type });
      return { ok: false, reason: issue };
    }

    const occurredAt = input.occurredAt
      ? new Date(input.occurredAt).toISOString()
      : new Date().toISOString();

    if (isDemoMode) {
      if (input.idempotencyKey) {
        const seen = demoDB.events.find(
          (e) => (e.payload.__key as string) === input.idempotencyKey,
        );
        if (seen) return { ok: true, id: seen.id, deduped: true };
      }
      const event: MidoEvent = {
        id: `ev${demoDB.seq++}`,
        type: input.type,
        actorUserId: "demo",
        subjectType: input.subjectType,
        subjectId: input.subjectId ?? null,
        organizationId: input.organizationId ?? null,
        teamId: input.teamId ?? null,
        source: input.source ?? "user",
        payload: input.idempotencyKey
          ? { ...(input.payload ?? {}), __key: input.idempotencyKey }
          : (input.payload ?? {}),
        occurredAt,
        createdAt: new Date().toISOString(),
        version: 1,
      };
      demoDB.events.push(event);
      return { ok: true, id: event.id };
    }

    const supabase = await createClient();
    if (!supabase) return { ok: false, reason: "No database client." };
    const user = await getAuthUser();
    if (!user) return { ok: false, reason: "No signed-in user to attribute this to." };

    const { data, error } = await supabase
      .from("mido_events")
      .insert({
        type: input.type,
        actor_user_id: user.id,
        subject_type: input.subjectType,
        subject_id: input.subjectId ?? null,
        organization_id: input.organizationId ?? null,
        team_id: input.teamId ?? null,
        source: input.source ?? "user",
        payload: input.payload ?? {},
        occurred_at: occurredAt,
        idempotency_key: input.idempotencyKey ?? null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      /*
        23505 is a unique violation, which here means the idempotency key
        already exists — the event was recorded by an earlier attempt.
        That is the mechanism working, not a failure.
      */
      if (error.code === "23505") return { ok: true, id: "deduped", deduped: true };
      console.error("[mido-events] insert failed", error.message);
      return { ok: false, reason: error.message };
    }

    return { ok: true, id: data?.id ?? "unknown" };
  } catch (e) {
    // The outer net. Nothing below this line reaches the caller's action.
    console.error("[mido-events] threw", e instanceof Error ? e.message : e);
    return { ok: false, reason: "Event could not be recorded." };
  }
}

export interface EventQuery {
  types?: MidoEventType[];
  subjectType?: MidoEvent["subjectType"];
  subjectId?: string;
  /** Only events at or after this moment. */
  since?: string | Date;
  limit?: number;
}

/**
 * What has this user done?
 *
 * Bounded by construction — there is no "read everything" call, because
 * the first place an event log gets expensive is a recommendation engine
 * innocently asking for a whole history on every page load.
 */
export async function listMidoEvents(q: EventQuery = {}): Promise<MidoEvent[]> {
  const limit = Math.min(q.limit ?? 100, 500);
  const since = q.since ? new Date(q.since).toISOString() : null;

  if (isDemoMode) {
    return demoDB.events
      .filter((e) => (q.types ? q.types.includes(e.type) : true))
      .filter((e) => (q.subjectType ? e.subjectType === q.subjectType : true))
      .filter((e) => (q.subjectId ? e.subjectId === q.subjectId : true))
      .filter((e) => (since ? e.occurredAt >= since : true))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, limit);
  }

  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const user = await getAuthUser();
    if (!user) return [];

    let query = supabase
      .from("mido_events")
      .select("*")
      .eq("actor_user_id", user.id)
      .order("occurred_at", { ascending: false })
      .limit(limit);

    if (q.types?.length) query = query.in("type", q.types);
    if (q.subjectType) query = query.eq("subject_type", q.subjectType);
    if (q.subjectId) query = query.eq("subject_id", q.subjectId);
    if (since) query = query.gte("occurred_at", since);

    const { data, error } = await query;
    if (error) {
      // Reading history must not take a page down either. An empty
      // history produces a weaker recommendation, not a crash.
      console.error("[mido-events] read failed", error.message);
      return [];
    }
    return (data ?? []).map(rowTo);
  } catch {
    return [];
  }
}

/**
 * When did this last happen? Null if never.
 *
 * The single most-asked question of this log — "has this player studied
 * this week?" — so it is one indexed query rather than a history read
 * the caller then scans.
 */
export async function lastOccurred(type: MidoEventType): Promise<string | null> {
  const [latest] = await listMidoEvents({ types: [type], limit: 1 });
  return latest?.occurredAt ?? null;
}

export { EVENT_SUBJECT };
