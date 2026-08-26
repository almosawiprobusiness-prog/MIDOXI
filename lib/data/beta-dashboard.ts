import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

/*
  The Founding XI dashboard's data.

  Read through the service-role client, past RLS, because this spans
  every player. Every query is defensive: a failure degrades that one
  metric rather than 500-ing the page.

  ───────────────────────────────────────────────────────────────────────
  WHAT THIS DELIBERATELY CANNOT TELL YOU
  ───────────────────────────────────────────────────────────────────────

  There is no page-view tracking in MIDO, so "how many times did they
  open the Locker" is unanswerable and stays unanswerable. That was a
  choice: a product that logs every screen a player looks at has built
  surveillance and called it analytics, and the questions worth asking
  about an eleven-player beta are all answerable from what people DID.

  So a feature's usage here means "how many players performed its
  action" — logged a match, completed a study — never "how many times
  they visited its page". Where that leaves a genuine blind spot, the
  dashboard says so rather than substituting a proxy that looks like an
  answer.
*/

export interface BetaPlayer {
  id: string;
  email: string;
  joined: string;
  onboarded: boolean;
  lastActive: string | null;
  activeDays: number;
  /** The core loop, per player. This is the retention question. */
  loop: {
    goal: boolean;
    checkin: boolean;
    study: boolean;
    match: boolean;
    review: boolean;
    training: boolean;
    film: boolean;
  };
}

export interface FeedbackItem {
  id: string;
  createdAt: string;
  email: string;
  kind: string;
  route: string | null;
  objectId: string | null;
  deviceClass: string | null;
  appVersion: string | null;
  rating: number | null;
  body: string | null;
  status: string;
  severity: string | null;
}

export interface BetaDashboard {
  available: boolean;
  /** True once migration 0033 has run and rows can exist. */
  analyticsReady: boolean;
  players: BetaPlayer[];
  /** How many distinct players performed each action, ever. */
  featureReach: { label: string; players: number; events: number }[];
  nba: { shown: number; opened: number; whyViewed: number; completed: number; dismissed: number };
  ai: { calls30d: number; errors30d: number; thumbsUp: number; thumbsDown: number };
  video: { total: number; ready: number; failed: number; processing: number };
  feedback: { open: FeedbackItem[]; countsByStatus: Record<string, number> };
}

const EMPTY: BetaDashboard = {
  available: false,
  analyticsReady: false,
  players: [],
  featureReach: [],
  nba: { shown: 0, opened: 0, whyViewed: 0, completed: 0, dismissed: 0 },
  ai: { calls30d: 0, errors30d: 0, thumbsUp: 0, thumbsDown: 0 },
  video: { total: 0, ready: 0, failed: 0, processing: 0 },
  feedback: { open: [], countsByStatus: {} },
};

/** Product action → the plain-English thing it means a player did. */
const REACH_LABELS: [string, string][] = [
  ["onboarding_completed", "Finished onboarding"],
  ["goal_created", "Set a development goal"],
  ["checkin_completed", "Checked in"],
  ["study_started", "Started a study"],
  ["study_completed", "Completed a study"],
  ["match_logged", "Logged a match"],
  ["match_review_completed", "Wrote a match review"],
  ["training_completed", "Logged training"],
  ["film_uploaded", "Added film"],
  ["film_analysis_completed", "Ran film analysis"],
];

export async function getBetaDashboard(): Promise<BetaDashboard> {
  const admin = createAdminClient();
  if (!admin) return EMPTY;

  const out: BetaDashboard = { ...EMPTY, available: true };
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // ── who they are ────────────────────────────────────────
  const users: { id: string; email: string; created_at: string }[] = [];
  try {
    // Eleven players. One page is the whole beta.
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of data?.users ?? []) {
      users.push({ id: u.id, email: u.email ?? "—", created_at: u.created_at });
    }
  } catch {
    return out;
  }

  // ── what they did ───────────────────────────────────────
  type Row = { user_id: string; event: string; created_at: string };
  let events: Row[] = [];
  try {
    const { data, error } = await admin
      .from("product_analytics")
      .select("user_id, event, created_at")
      .gte("created_at", new Date(Date.now() - 120 * 86_400_000).toISOString())
      .limit(20000);
    /*
      A missing table means migration 0033 has not run. That is a
      different state from "nobody has done anything", and the dashboard
      says which — otherwise an un-run migration looks exactly like a
      dead beta, which is the most alarming possible way to be wrong.
    */
    if (!error) out.analyticsReady = true;
    events = (data ?? []) as Row[];
  } catch {
    /* analyticsReady stays false */
  }

  const byUser = new Map<string, Row[]>();
  for (const e of events) {
    const list = byUser.get(e.user_id) ?? [];
    list.push(e);
    byUser.set(e.user_id, list);
  }

  out.players = users
    .map((u) => {
      const mine = byUser.get(u.id) ?? [];
      const has = (ev: string) => mine.some((e) => e.event === ev);
      const days = new Set(mine.map((e) => e.created_at.slice(0, 10)));
      const last = mine.reduce<string | null>(
        (acc, e) => (!acc || e.created_at > acc ? e.created_at : acc),
        null,
      );
      return {
        id: u.id,
        email: u.email,
        joined: u.created_at,
        onboarded: has("onboarding_completed"),
        lastActive: last,
        activeDays: days.size,
        loop: {
          goal: has("goal_created"),
          checkin: has("checkin_completed"),
          study: has("study_completed"),
          match: has("match_logged"),
          review: has("match_review_completed"),
          training: has("training_completed"),
          film: has("film_uploaded"),
        },
      };
    })
    .sort((a, b) => (b.lastActive ?? "").localeCompare(a.lastActive ?? ""));

  out.featureReach = REACH_LABELS.map(([event, label]) => {
    const rows = events.filter((e) => e.event === event);
    return { label, players: new Set(rows.map((r) => r.user_id)).size, events: rows.length };
  });

  const count = (ev: string) => events.filter((e) => e.event === ev).length;
  out.nba = {
    shown: count("recommendation_shown"),
    opened: count("recommendation_opened"),
    whyViewed: count("recommendation_why_viewed"),
    completed: count("recommendation_completed"),
    dismissed: count("recommendation_dismissed"),
  };

  // ── AI health ───────────────────────────────────────────
  try {
    const { data } = await admin
      .from("ai_usage_events")
      .select("status")
      .gte("created_at", since30)
      .limit(5000);
    const rows = data ?? [];
    out.ai.calls30d = rows.length;
    out.ai.errors30d = rows.filter((r) => r.status !== "ok").length;
  } catch {
    /* leave zeroes */
  }

  // ── video ───────────────────────────────────────────────
  try {
    const { data } = await admin.from("videos").select("status").limit(5000);
    const rows = data ?? [];
    out.video.total = rows.length;
    out.video.ready = rows.filter((r) => r.status === "ready").length;
    out.video.failed = rows.filter((r) => r.status === "failed").length;
    out.video.processing = rows.filter(
      (r) => r.status === "processing" || r.status === "uploading",
    ).length;
  } catch {
    /* leave zeroes */
  }

  // ── feedback ────────────────────────────────────────────
  try {
    const { data } = await admin
      .from("beta_feedback")
      .select("id, created_at, user_id, kind, route, object_id, device_class, app_version, rating, body, status, severity")
      .order("created_at", { ascending: false })
      .limit(300);
    const rows = data ?? [];
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    for (const r of rows) {
      const status = String(r.status ?? "new");
      out.feedback.countsByStatus[status] = (out.feedback.countsByStatus[status] ?? 0) + 1;
      if (String(r.kind) === "ai_feedback" || String(r.kind) === "ai_rating") {
        if (r.rating === 1) out.ai.thumbsUp++;
        if (r.rating === -1) out.ai.thumbsDown++;
      }
    }

    out.feedback.open = rows
      .filter((r) => ["new", "investigating"].includes(String(r.status ?? "new")))
      .map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at),
        email: emailById.get(String(r.user_id)) ?? "—",
        kind: String(r.kind),
        route: (r.route as string) ?? null,
        objectId: (r.object_id as string) ?? null,
        deviceClass: (r.device_class as string) ?? null,
        appVersion: (r.app_version as string) ?? null,
        rating: (r.rating as number) ?? null,
        body: (r.body as string) ?? null,
        status: String(r.status ?? "new"),
        severity: (r.severity as string) ?? null,
      }));
  } catch {
    /* leave empty */
  }

  return out;
}
