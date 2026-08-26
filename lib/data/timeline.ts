import "server-only";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoStore } from "./store";
import { listGoals } from "./development";
import { getRecovery } from "./recovery";
import {
  groupByDay,
  type TimelineEntry,
  type TimelineKind,
  type TimelineView,
} from "./timeline-types";

/*
  The player timeline.

  Real mode is one select against `player_timeline` (migration 0015) — a view
  over matches, training, check-ins, clips, film reads, studies, goals, evidence
  and coach feedback. There is no timeline table and nothing writes to it, so it
  cannot drift from the data it describes.

  The view is created with `security_invoker = true`, which means RLS on the
  underlying tables decides what comes back. The explicit `user_id` filter below
  is belt as well as braces: it makes the query planner's job obvious and it
  makes the intent readable, but it is not what provides the isolation.
*/

export interface TimelineQuery {
  /** How far back to read. */
  days?: number;
  /** Restrict to these kinds. Empty or omitted means everything. */
  kinds?: TimelineKind[];
  /** Hard ceiling on rows. */
  limit?: number;
  /** Explicit window, overriding `days`. Both ends inclusive, ISO. */
  from?: string;
  to?: string;
  /**
   * Read somebody ELSE's timeline, with the service role.
   *
   * The only caller that may pass this is the public share route, which got
   * the id from a token it validated. RLS is bypassed on this path, so the
   * `user_id` filter below stops being belt-and-braces and becomes the whole
   * isolation — which is why it is applied unconditionally rather than only
   * when a session exists.
   */
  forUser?: string;
}

const DEFAULT_DAYS = 90;
const DEFAULT_LIMIT = 400;

function windowOf(q: TimelineQuery): { from: string; to: string } {
  const to = q.to ?? new Date().toISOString();
  const from =
    q.from ?? new Date(new Date(to).getTime() - (q.days ?? DEFAULT_DAYS) * 864e5).toISOString();
  return { from, to };
}

export async function getTimeline(q: TimelineQuery = {}): Promise<TimelineView> {
  const { from, to } = windowOf(q);
  const limit = Math.min(q.limit ?? DEFAULT_LIMIT, 1000);

  if (isDemoMode) return demoTimeline(from, to, q.kinds, limit);

  const owner = q.forUser;
  const supabase = owner ? createAdminClient() : await createClient();
  if (!supabase) return empty(from, to);

  let userId = owner;
  if (!userId) {
    const user = await getAuthUser();
    if (!user) return empty(from, to);
    userId = user.id;
  }

  let query = supabase
    .from("player_timeline")
    .select("occurred_at, kind, ref_id, title, summary, meta")
    .eq("user_id", userId)
    .gte("occurred_at", from)
    .lte("occurred_at", to)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (q.kinds?.length) query = query.in("kind", q.kinds);

  const { data, error } = await query;
  if (error) {
    // A missing view means migration 0015 has not been run. Say so rather than
    // rendering an empty record, which would read as "you have done nothing".
    throw new Error(
      `The timeline could not be read: ${error.message}. If this mentions player_timeline, migration 0015 has not been applied.`,
    );
  }

  const entries: TimelineEntry[] = (data ?? []).map(rowTo);

  /*
    Name the thread. Clip, study and evidence rows already carry a
    goalId in the view's meta — but an id renders as nothing, so the
    development connection the timeline exists to show was invisible: a
    clip called "Near-post arrival" sat one row from the goal it
    evidenced with no line between them. Titles are stamped at read
    time, from one bounded read, because changing player_timeline
    itself is a migration and a decision — this is neither.

    Only for the player's own view: on the coach path (`forUser`) the
    signed-in user's goals are the wrong player's.
  */
  if (!owner) {
    const goals = await listGoals().catch(() => []);
    const titleById = new Map(goals.map((g) => [g.id, g.title]));
    for (const e of entries) {
      const gid = e.meta.goalId;
      if (typeof gid === "string" && titleById.has(gid)) {
        e.meta.goalTitle = titleById.get(gid);
      }
    }
  }

  return { source: "yours", entries, days: groupByDay(entries), from, to };
}

function rowTo(r: Record<string, unknown>): TimelineEntry {
  const kind = r.kind as TimelineKind;
  const refId = String(r.ref_id ?? "");
  return {
    id: `${kind}:${refId}`,
    occurredAt: String(r.occurred_at),
    kind,
    refId,
    title: (r.title as string) ?? "",
    summary: (r.summary as string) ?? null,
    meta: (r.meta as Record<string, unknown>) ?? {},
  };
}

function empty(from: string, to: string): TimelineView {
  return { source: "yours", entries: [], days: [], from, to };
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

/*
  Assembled from the same seeded rows every other demo surface reads, so the
  demo timeline agrees with the demo match log, the demo development board and
  the demo film room. A timeline that told a different story from the pages it
  summarises would be worse than no timeline at all.
*/
async function demoTimeline(
  from: string,
  to: string,
  kinds: TimelineKind[] | undefined,
  limit: number,
): Promise<TimelineView> {
  const out: TimelineEntry[] = [];
  const add = (e: TimelineEntry) => out.push(e);

  for (const m of demoStore.listMatches()) {
    add({
      id: `match:${m.id}`,
      occurredAt: m.date,
      kind: "match",
      refId: m.id,
      title: `${m.home ? "vs " : "away to "}${m.opponent}`,
      summary: [m.competition, `${m.goalsFor}–${m.goalsAgainst}`, `${m.minutes} min`]
        .filter(Boolean)
        .join(" · "),
      meta: {
        minutes: m.minutes,
        goals: m.goals,
        assists: m.assists,
        rating: m.rating,
        position: m.position,
        started: m.started,
        competition: m.competition,
        reviewed: m.reviewed,
      },
    });
  }

  for (const t of demoStore.listTraining()) {
    add({
      id: `training:${t.id}`,
      occurredAt: new Date(t.scheduledAt).toISOString(),
      kind: "training",
      refId: t.id,
      title: t.title,
      summary: [t.kind, t.durationMin ? `${t.durationMin} min` : null, t.objective]
        .filter(Boolean)
        .join(" · "),
      meta: { sessionKind: t.kind, durationMin: t.durationMin ?? null, objective: t.objective ?? null },
    });
  }

  const recovery = await getRecovery(14);
  for (const d of recovery.days) {
    add({
      id: `checkin:${d.date}`,
      occurredAt: `${d.date}T12:00:00.000Z`,
      kind: "checkin",
      refId: d.date,
      title: "Check-in",
      summary: d.note,
      meta: { energy: d.energy, soreness: d.soreness, sleep: d.sleep, mental: d.mental },
    });
  }

  for (const c of demoStore.listClips()) {
    add({
      id: `clip:${c.id}`,
      occurredAt: c.createdAt,
      kind: "clip",
      refId: c.id,
      title: c.title,
      summary: c.note || null,
      meta: {
        videoId: c.videoId,
        matchId: c.matchId ?? null,
        goalId: c.goalId ?? null,
        startSeconds: c.startSeconds,
        sentiment: c.sentiment ?? null,
        favorite: c.favorite,
      },
    });
  }

  for (const s of demoStore.listStudySessions()) {
    add({
      id: `study_session:${s.id}`,
      occurredAt: s.createdAt,
      kind: "study_session",
      refId: s.id,
      title: s.title,
      summary: s.summary || null,
      meta: { completed: s.completed, goalId: s.goalId ?? null },
    });
  }

  for (const g of demoStore.listGoals()) {
    const detail = demoStore.getGoal(g.id);
    for (const e of detail?.evidence ?? []) {
      add({
        id: `evidence:${e.id}`,
        occurredAt: e.createdAt,
        kind: "evidence",
        refId: e.id,
        title: e.note || "Evidence added",
        summary: null,
        meta: { goalId: g.id, goalTitle: g.title, evidenceKind: e.kind, source: "self" },
      });
    }
  }

  // Same read-time stamping the real path does, for clip/study rows
  // whose goalId was recorded above without a title.
  {
    const titleById = new Map(demoStore.listGoals().map((g) => [g.id, g.title]));
    for (const e of out) {
      const gid = e.meta.goalId;
      if (typeof gid === "string" && !e.meta.goalTitle && titleById.has(gid)) {
        e.meta.goalTitle = titleById.get(gid);
      }
    }
  }

  const wanted = kinds?.length ? new Set(kinds) : null;
  const entries = out
    .filter((e) => (!wanted || wanted.has(e.kind)) && e.occurredAt >= from && e.occurredAt <= to)
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .slice(0, limit);

  return { source: "demo", entries, days: groupByDay(entries), from, to };
}
