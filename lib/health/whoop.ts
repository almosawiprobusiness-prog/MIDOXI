import "server-only";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import type { ProviderId } from "./providers";

/*
  WHOOP — OAuth, refresh, and turning their records into ours.

  WHY THIS FILE IS server-only AND USES THE ADMIN CLIENT. Refresh
  tokens are stored in `provider_tokens`, a table `authenticated` holds
  no privilege on at all. Nothing here may be reached from a component;
  the only entry points are the two route handlers and the sync action.

  WHAT IS AND IS NOT RECORDED. WHOOP scores a night as UNSCORED when the
  strap was off or the data was thin. Those records are kept, with their
  metrics null, rather than dropped or defaulted — a missing HRV has to
  render as absent, never as zero, on a page a player uses to decide
  whether to train.
*/

const AUTH_HOST = "https://api.prod.whoop.com";
const API = `${AUTH_HOST}/developer/v2`;

/*
  `offline` is what returns a refresh token. Without it the connection
  works for one hour and then silently stops, which looks exactly like a
  bug and is the most common way this integration is got wrong.
*/
export const WHOOP_SCOPES = [
  "offline",
  "read:recovery",
  "read:sleep",
  "read:cycles",
  "read:profile",
].join(" ");

export const WHOOP_REDIRECT_PATH = "/api/health/whoop/callback";

export function whoopRedirectUri(): string {
  return `${env.appUrl.replace(/\/$/, "")}${WHOOP_REDIRECT_PATH}`;
}

export function whoopAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env.whoopClientId,
    redirect_uri: whoopRedirectUri(),
    response_type: "code",
    scope: WHOOP_SCOPES,
    state,
  });
  return `${AUTH_HOST}/oauth/oauth2/auth?${p.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_HOST}/oauth/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      ...body,
      client_id: env.whoopClientId,
      client_secret: env.whoopClientSecret,
    }).toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    // The body carries WHOOP's reason; the status alone is never enough
    // to tell a wrong redirect URI from an expired code.
    throw new Error(`WHOOP token ${res.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as TokenResponse;
}

export const exchangeCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: whoopRedirectUri() });

const refreshToken = (token: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: token, scope: WHOOP_SCOPES });

// ---------------------------------------------------------------------------
// Storing the connection
// ---------------------------------------------------------------------------

export async function saveConnection(
  userId: string,
  provider: ProviderId,
  token: TokenResponse,
  externalUserId: string | null,
): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: conn, error } = await admin
    .from("provider_connections")
    .upsert(
      {
        user_id: userId,
        provider,
        status: "active",
        external_user_id: externalUserId,
        scopes: token.scope ?? WHOOP_SCOPES,
        connected_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "user_id,provider" },
    )
    .select("id")
    .maybeSingle();

  if (error || !conn) return null;

  await admin.from("provider_tokens").upsert(
    {
      connection_id: conn.id,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id" },
  );

  return conn.id;
}

/**
 * A usable access token, refreshed if it is close to expiring.
 *
 * The sixty-second margin matters: a token that passes an `expires_at`
 * check and then expires during the request that used it produces a 401
 * that looks like a revoked connection rather than a stale clock.
 */
async function freshAccessToken(connectionId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: row } = await admin
    .from("provider_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (!row) return null;

  const expiresAt = row.expires_at ? Date.parse(String(row.expires_at)) : 0;
  if (expiresAt - Date.now() > 60_000) return String(row.access_token);

  if (!row.refresh_token) {
    await markExpired(connectionId, "WHOOP did not return a refresh token. Reconnect to continue syncing.");
    return null;
  }

  try {
    const next = await refreshToken(String(row.refresh_token));
    await admin
      .from("provider_tokens")
      .update({
        access_token: next.access_token,
        // WHOOP rotates refresh tokens: the old one stops working the
        // moment this succeeds, so failing to store the new one strands
        // the connection permanently.
        refresh_token: next.refresh_token ?? row.refresh_token,
        expires_at: new Date(Date.now() + next.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("connection_id", connectionId);
    return next.access_token;
  } catch (e) {
    await markExpired(connectionId, e instanceof Error ? e.message : "Could not refresh WHOOP access.");
    return null;
  }
}

async function markExpired(connectionId: string, message: string) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin
    .from("provider_connections")
    .update({ status: "expired", last_error: message })
    .eq("id", connectionId);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

async function api<T>(connectionId: string, path: string): Promise<T | null> {
  const token = await freshAccessToken(connectionId);
  if (!token) return null;
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    await markExpired(connectionId, "WHOOP refused the connection. Reconnect to continue syncing.");
    return null;
  }
  if (!res.ok) throw new Error(`WHOOP ${path} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as T;
}

export async function whoopProfile(connectionId: string) {
  return api<{ user_id: number; email?: string }>(connectionId, "/user/profile/basic");
}

interface Paged<T> {
  records: T[];
  next_token?: string | null;
}

/*
  WHOOP pages at 25 records maximum. `limit` here is a ceiling on PAGES,
  not records — an unbounded follow-the-cursor loop against somebody
  else's API is how a sync job runs for an hour on an account with years
  of history.
*/
async function pages<T>(connectionId: string, path: string, start: string, maxPages = 8): Promise<T[]> {
  const out: T[] = [];
  let token: string | null | undefined;
  for (let i = 0; i < maxPages; i++) {
    const q = new URLSearchParams({ start, limit: "25" });
    if (token) q.set("nextToken", token);
    const page = await api<Paged<T>>(connectionId, `${path}?${q.toString()}`);
    if (!page) break;
    out.push(...(page.records ?? []));
    token = page.next_token;
    if (!token) break;
  }
  return out;
}

interface WhoopRecovery {
  cycle_id: number;
  sleep_id: string;
  created_at: string;
  score_state: string;
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
}

interface WhoopSleep {
  id: string;
  start: string;
  end: string;
  score_state: string;
  score?: {
    sleep_performance_percentage?: number;
    sleep_efficiency_percentage?: number;
    stage_summary?: { total_in_bed_time_milli?: number };
    sleep_needed?: { baseline_milli?: number };
  };
}

interface WhoopCycle {
  id: number;
  start: string;
  score_state: string;
  score?: { strain?: number };
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** The day a reading belongs to, in local terms rather than UTC. */
const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/**
 * Pull the last `days` of WHOOP data and write it into `recovery_samples`.
 *
 * Returns what happened, in words, because a "Sync" button that reports
 * nothing is indistinguishable from one that silently failed.
 */
export async function syncWhoop(
  userId: string,
  connectionId: string,
  days = 30,
): Promise<{ ok: boolean; written: number; message: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, written: 0, message: "No backend configured." };

  const start = new Date(Date.now() - days * 864e5).toISOString();

  try {
    const [recoveries, sleeps, cycles] = await Promise.all([
      pages<WhoopRecovery>(connectionId, "/recovery", start),
      pages<WhoopSleep>(connectionId, "/activity/sleep", start),
      pages<WhoopCycle>(connectionId, "/cycle", start),
    ]);

    // Keyed so sleep and strain can be attached to the right day's recovery.
    const sleepById = new Map(sleeps.map((s) => [s.id, s]));
    const cycleById = new Map(cycles.map((c) => [c.id, c]));

    const rows = recoveries.map((r) => {
      const sleep = r.sleep_id ? sleepById.get(r.sleep_id) : undefined;
      const cycle = cycleById.get(r.cycle_id);

      /*
        The day comes from the CYCLE start, not the recovery's
        `created_at`. A WHOOP cycle begins when you wake, so a recovery
        computed at 06:40 belongs to that day — using the UTC timestamp
        puts anybody west of Greenwich on the wrong date.
      */
      const day = dayOf(cycle?.start ?? r.created_at);

      const inBed = num(sleep?.score?.stage_summary?.total_in_bed_time_milli);
      const needed = num(sleep?.score?.sleep_needed?.baseline_milli);

      return {
        user_id: userId,
        source: "whoop" as const,
        day,
        recorded_at: r.created_at,
        // Only SCORED records carry numbers. An unscored night keeps its
        // row with nulls, so the page can say "not measured" honestly.
        recovery_score: r.score_state === "SCORED" ? num(r.score?.recovery_score) : null,
        hrv_ms: r.score_state === "SCORED" ? num(r.score?.hrv_rmssd_milli) : null,
        resting_hr: r.score_state === "SCORED" ? num(r.score?.resting_heart_rate) : null,
        spo2_percent: r.score_state === "SCORED" ? num(r.score?.spo2_percentage) : null,
        skin_temp_c: r.score_state === "SCORED" ? num(r.score?.skin_temp_celsius) : null,
        sleep_performance:
          sleep?.score_state === "SCORED" ? num(sleep?.score?.sleep_performance_percentage) : null,
        sleep_efficiency:
          sleep?.score_state === "SCORED" ? num(sleep?.score?.sleep_efficiency_percentage) : null,
        sleep_duration_min: inBed === null ? null : Math.round(inBed / 60000),
        sleep_need_min: needed === null ? null : Math.round(needed / 60000),
        strain: cycle?.score_state === "SCORED" ? num(cycle?.score?.strain) : null,
        external_id: String(r.cycle_id),
        raw: { recovery: r, sleep: sleep ?? null, cycle: cycle ?? null },
        updated_at: new Date().toISOString(),
      };
    });

    if (rows.length > 0) {
      const { error } = await admin
        .from("recovery_samples")
        .upsert(rows, { onConflict: "user_id,source,day" });
      if (error) throw new Error(error.message);
    }

    await admin
      .from("provider_connections")
      .update({ last_sync_at: new Date().toISOString(), last_error: null, status: "active" })
      .eq("id", connectionId);

    return {
      ok: true,
      written: rows.length,
      message:
        rows.length === 0
          ? "Connected, but WHOOP returned nothing for the last 30 days."
          : `${rows.length} day${rows.length === 1 ? "" : "s"} synced from WHOOP.`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "WHOOP sync failed.";
    await admin.from("provider_connections").update({ last_error: message }).eq("id", connectionId);
    return { ok: false, written: 0, message };
  }
}
