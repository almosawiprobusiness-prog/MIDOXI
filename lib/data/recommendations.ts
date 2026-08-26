import "server-only";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { emitMidoEvent } from "@/lib/events/emit";
import { idempotencyKey } from "@/lib/events/types";
import {
  isStale,
  toSurfaced,
  RECOMMENDATION_TTL_DAYS,
  DISMISS_COOLDOWN_DAYS,
  SETTLED_QUIET_DAYS,
  type Recommendation,
  type RecommendationSource,
} from "@/lib/intelligence/recommendation-types";
import type { ActionKind, RankedAction } from "@/lib/intelligence/next-best-action";

/*
  Advice MIDO actually gave.

  The scorer ranks on every dashboard load; this stores only what was
  put in front of somebody, so the table answers "what has MIDO told
  this player, and what did they do about it" rather than logging
  arithmetic.
*/

/** In demo mode the row carries its own close time; the real table has columns. */
type DemoRow = Recommendation & { settledAt?: string };

interface DemoDB {
  rows: DemoRow[];
  seq: number;
}
const g = globalThis as unknown as { __midoRecDB?: DemoDB };
const demoDB: DemoDB = (g.__midoRecDB ??= { rows: [], seq: 1 });

function rowTo(r: Record<string, unknown>): Recommendation {
  return {
    id: r.id as string,
    kind: r.kind as ActionKind,
    title: (r.title as string) ?? "",
    reason: (r.reason as string) ?? "",
    priority: Number(r.priority ?? 0),
    sources: Array.isArray(r.sources) ? (r.sources as RecommendationSource[]) : [],
    status: (r.status as Recommendation["status"]) ?? "active",
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
    expiresAt: (r.expires_at as string) ?? null,
  };
}

function expiryFrom(now: Date): string {
  return new Date(now.getTime() + RECOMMENDATION_TTL_DAYS * 86_400_000).toISOString();
}

/**
 * Record what was shown, and retire what no longer is.
 *
 * RECONCILES rather than appends. Three things happen:
 *
 *   · a kind already active is UPDATED in place, so re-ranking twice an
 *     hour does not produce two rows
 *   · a kind not yet active is inserted
 *   · a kind that was active and is no longer surfaced is EXPIRED,
 *     because advice nobody is being given any more should not still
 *     read as current
 *
 * Deliberately not an upsert: the "one active per kind" rule lives in a
 * partial unique index, which PostgREST cannot reliably target as a
 * conflict key. Reading the handful of active rows first and deciding
 * explicitly is slower by one query and correct without depending on
 * that.
 *
 * Never throws — a dashboard must render even if its bookkeeping fails.
 */
/**
 * Kinds the player already answered today, either way.
 *
 * The scorer cannot see this for itself: it ranks from the record, and
 * neither pressing "Done" nor pressing "Not now" puts anything in the
 * record. Re-ranking unchanged inputs returns the same card — and with
 * one card gone, the one that was just dismissed is promoted into the
 * slot it was dismissed from.
 *
 * So both are honoured for the day. The scorer's week-long halving of a
 * dismissal still does the longer work; this only stops MIDO arguing
 * with an answer it was given a minute ago.
 */
async function settledRecently(now: Date): Promise<Set<ActionKind>> {
  const since = now.getTime() - SETTLED_QUIET_DAYS * 86_400_000;
  const answered = ["completed", "dismissed"];

  if (isDemoMode) {
    return new Set(
      demoDB.rows
        .filter((r) => answered.includes(r.status))
        .filter((r) => !r.settledAt || Date.parse(r.settledAt) >= since)
        .map((r) => r.kind),
    );
  }

  try {
    const supabase = await createClient();
    if (!supabase) return new Set();
    const user = await getAuthUser();
    if (!user) return new Set();

    /*
      Two columns hold the time, one per status, so this asks by row age
      rather than by either stamp — `updated_at` is not a column here and
      created_at would be wrong. Cheap because the window is a day and
      the table holds at most one row per kind per status.
    */
    const { data } = await supabase
      .from("mido_recommendations")
      .select("kind, completed_at, dismissed_at")
      .eq("user_id", user.id)
      .in("status", answered)
      .limit(40);

    const out = new Set<ActionKind>();
    for (const r of data ?? []) {
      const at = (r.completed_at as string | null) ?? (r.dismissed_at as string | null);
      if (at && Date.parse(at) >= since) out.add(r.kind as ActionKind);
    }
    return out;
  } catch {
    // Failing open re-offers something already answered — mildly
    // annoying, and better than a dashboard with no advice on it.
    return new Set();
  }
}

export async function surfaceRecommendations(
  actions: RankedAction[],
  now: Date = new Date(),
): Promise<Recommendation[]> {
  const settled = await settledRecently(now);
  const wanted = actions.map(toSurfaced).filter((w) => !settled.has(w.kind));
  const wantedKinds = new Set(wanted.map((w) => w.kind));

  if (isDemoMode) {
    for (const row of demoDB.rows) {
      if (row.status === "active" && !wantedKinds.has(row.kind)) row.status = "expired";
    }
    for (const w of wanted) {
      const existing = demoDB.rows.find((r) => r.status === "active" && r.kind === w.kind);
      if (existing) {
        Object.assign(existing, w, { expiresAt: expiryFrom(now) });
      } else {
        demoDB.rows.push({
          id: `rec${demoDB.seq++}`,
          ...w,
          status: "active",
          createdAt: now.toISOString(),
          expiresAt: expiryFrom(now),
        });
      }
    }
    return listFromDemo();
  }

  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const user = await getAuthUser();
    if (!user) return [];

    const { data: active } = await supabase
      .from("mido_recommendations")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active");

    const existing = (active ?? []).map(rowTo);
    const byKind = new Map(existing.map((r) => [r.kind, r]));

    // Retire what is no longer being said.
    const gone = existing.filter((r) => !wantedKinds.has(r.kind)).map((r) => r.id);
    if (gone.length) {
      await supabase.from("mido_recommendations").update({ status: "expired" }).in("id", gone);
    }

    for (const w of wanted) {
      const current = byKind.get(w.kind);
      if (current) {
        await supabase
          .from("mido_recommendations")
          .update({
            title: w.title,
            reason: w.reason,
            priority: w.priority,
            sources: w.sources,
            expires_at: expiryFrom(now),
          })
          .eq("id", current.id);
      } else {
        const { data: made } = await supabase
          .from("mido_recommendations")
          .insert({
            user_id: user.id,
            kind: w.kind,
            title: w.title,
            reason: w.reason,
            priority: w.priority,
            sources: w.sources,
            expires_at: expiryFrom(now),
          })
          .select("id")
          .maybeSingle();

        /*
          Emitted only for genuinely NEW advice, not for a re-rank of the
          same kind. Without that distinction the log would record MIDO
          "recommending" the same recovery every time a page loaded.
        */
        if (made?.id) {
          await emitMidoEvent({
            type: "MIDO_RECOMMENDATION_CREATED",
            subjectType: "recommendation",
            subjectId: made.id,
            source: "system",
            payload: { kind: w.kind, priority: w.priority },
            idempotencyKey: idempotencyKey(["rec", "created", made.id]),
          });
        }
      }
    }

    return listActiveRecommendations(now);
  } catch {
    return [];
  }
}

function listFromDemo(now: Date = new Date()): Recommendation[] {
  return demoDB.rows
    .filter((r) => r.status === "active" && !isStale(r, now))
    .sort((a, b) => b.priority - a.priority);
}

/** What MIDO is currently telling this player, best first. */
/**
 * Every recent row, whatever its status. For the inspector only.
 *
 * The product never needs this — a player is shown what is active, not
 * an archive of advice. A developer asking "did the dismissal actually
 * write" does, and answering it from the event log alone means trusting
 * two systems to debug one.
 */
export async function listRecentRecommendations(limit = 25): Promise<Recommendation[]> {
  if (isDemoMode) {
    return [...demoDB.rows]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const user = await getAuthUser();
    if (!user) return [];

    const { data } = await supabase
      .from("mido_recommendations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map(rowTo);
  } catch {
    return [];
  }
}

export async function listActiveRecommendations(now: Date = new Date()): Promise<Recommendation[]> {
  if (isDemoMode) return listFromDemo(now);

  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const user = await getAuthUser();
    if (!user) return [];

    const { data } = await supabase
      .from("mido_recommendations")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("priority", { ascending: false })
      .limit(10);

    /*
      Expiry is filtered on READ as well as being a column.

      A row sits past its expiry for as long as nothing runs, and there
      is no sweeper here. Trusting `status` alone would show week-old
      advice as current — which is the one failure this table exists to
      avoid.
    */
    return (data ?? []).map(rowTo).filter((r) => !isStale(r, now));
  } catch {
    return [];
  }
}

async function close(
  id: string,
  status: "completed" | "dismissed",
): Promise<boolean> {
  const stamp = status === "completed" ? "completed_at" : "dismissed_at";
  const type = status === "completed"
    ? "MIDO_RECOMMENDATION_COMPLETED"
    : "MIDO_RECOMMENDATION_DISMISSED";

  if (isDemoMode) {
    const row = demoDB.rows.find((r) => r.id === id);
    if (!row) return false;
    row.status = status;
    row.settledAt = new Date().toISOString();
    await emitMidoEvent({
      type,
      subjectType: "recommendation",
      subjectId: id,
      payload: { kind: row.kind },
      idempotencyKey: idempotencyKey(["rec", status, id]),
    });
    return true;
  }

  try {
    const supabase = await createClient();
    if (!supabase) return false;

    const { data } = await supabase
      .from("mido_recommendations")
      .update({ status, [stamp]: new Date().toISOString() })
      .eq("id", id)
      .select("kind")
      .maybeSingle();
    if (!data) return false;

    await emitMidoEvent({
      type,
      subjectType: "recommendation",
      subjectId: id,
      payload: { kind: data.kind },
      idempotencyKey: idempotencyKey(["rec", status, id]),
    });
    return true;
  } catch {
    return false;
  }
}

/** The player did it. Closes the loop the scorer reads next time. */
export function completeRecommendation(id: string) {
  return close(id, "completed");
}

/** The player waved it away. */
export function dismissRecommendation(id: string) {
  return close(id, "dismissed");
}

/**
 * What has been waved away lately.
 *
 * Feeds `PlayerSignals.recentlyDismissed`, which the scorer halves
 * rather than removes — so a dismissal is respected without being
 * permanent. This is the half of the loop that was previously an empty
 * array with a note saying the store did not exist yet.
 */
export async function recentlyDismissedKinds(now: Date = new Date()): Promise<ActionKind[]> {
  const since = new Date(now.getTime() - DISMISS_COOLDOWN_DAYS * 86_400_000).toISOString();

  if (isDemoMode) {
    return demoDB.rows
      .filter((r) => r.status === "dismissed")
      .filter((r) => !r.settledAt || r.settledAt >= since)
      .map((r) => r.kind);
  }

  try {
    const supabase = await createClient();
    if (!supabase) return [];
    const user = await getAuthUser();
    if (!user) return [];

    const { data } = await supabase
      .from("mido_recommendations")
      .select("kind")
      .eq("user_id", user.id)
      .eq("status", "dismissed")
      .gte("dismissed_at", since)
      .limit(20);

    return [...new Set((data ?? []).map((r) => r.kind as ActionKind))];
  } catch {
    return [];
  }
}
