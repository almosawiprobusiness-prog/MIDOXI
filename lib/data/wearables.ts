import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { Connection, ProviderId, RecoverySample } from "@/lib/health/providers";

/*
  Reading measured physiology.

  Note what is NOT here: nothing combines these with `daily_checkins`.
  A WHOOP HRV reading and a player typing "4 out of 5 for sleep" are
  different kinds of fact, and averaging them into a single readiness
  number would be exactly the invented physiology the Recovery page was
  rebuilt to remove. The page shows both, side by side, labelled.

  Demo mode returns nothing rather than plausible-looking numbers. A
  demo that shows a fake HRV of 68ms teaches the reader that MIDO
  measures HRV, which for anybody without a strap is false.
*/

const SAMPLE_COLUMNS =
  "day, source, recovery_score, hrv_ms, resting_hr, spo2_percent, skin_temp_c, " +
  "sleep_performance, sleep_duration_min, sleep_need_min, sleep_efficiency, strain";

interface ConnectionRow {
  provider: string;
  status: string;
  connected_at: string;
  last_sync_at: string | null;
  last_error: string | null;
}

export async function listConnections(): Promise<Connection[]> {
  if (isDemoMode) return [];

  const supabase = await createClient();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("provider_connections")
    .select("provider, status, connected_at, last_sync_at, last_error")
    .eq("user_id", user.id);

  return ((data ?? []) as unknown as ConnectionRow[]).map((r) => ({
    provider: r.provider as ProviderId,
    status: r.status as Connection["status"],
    connectedAt: String(r.connected_at),
    lastSyncAt: (r.last_sync_at as string) ?? null,
    lastError: (r.last_error as string) ?? null,
  }));
}

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/*
  The row as it comes back.

  Declared explicitly because the generated Supabase types do not yet
  know these tables, and without it every field infers as an error type.
  Numeric columns arrive as strings over PostgREST, which is why `num`
  exists rather than a bare cast.
*/
interface SampleRow {
  day: string;
  source: string;
  recovery_score: number | null;
  hrv_ms: string | number | null;
  resting_hr: number | null;
  spo2_percent: string | number | null;
  skin_temp_c: string | number | null;
  sleep_performance: number | null;
  sleep_duration_min: number | null;
  sleep_need_min: number | null;
  sleep_efficiency: string | number | null;
  strain: string | number | null;
}

export async function listRecoverySamples(days = 14): Promise<RecoverySample[]> {
  if (isDemoMode) return [];

  const supabase = await createClient();
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("recovery_samples")
    .select(SAMPLE_COLUMNS)
    .eq("user_id", user.id)
    .gte("day", since)
    .order("day", { ascending: false });

  return ((data ?? []) as unknown as SampleRow[]).map((r) => ({
    day: String(r.day),
    source: r.source as ProviderId,
    recoveryScore: num(r.recovery_score),
    hrvMs: num(r.hrv_ms),
    restingHr: num(r.resting_hr),
    spo2Percent: num(r.spo2_percent),
    skinTempC: num(r.skin_temp_c),
    sleepPerformance: num(r.sleep_performance),
    sleepDurationMin: num(r.sleep_duration_min),
    sleepNeedMin: num(r.sleep_need_min),
    sleepEfficiency: num(r.sleep_efficiency),
    strain: num(r.strain),
  }));
}
