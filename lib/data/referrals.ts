import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode, env } from "@/lib/env";
import {
  REWARD,
  generateReferralCode,
  isPlausibleReferralCode,
  normaliseReferralCode,
  referralUrl,
  statsFrom,
  type Referral,
  type ReferralOverview,
  type Reward,
} from "./referral-types";

/*
  Referral data access.

  Real mode goes entirely through the security-definer functions in migration
  0011. Every one of them exists because the honest version of this feature
  needs the database to decide, not the interface:

    my_referral_code       — mints a code; clients never insert one
    record_referral_visit  — counts a click, anonymously, callable by anon
    attribute_referral     — links a *new* account to a code, once
    my_referrals           — the referrer's own numbers, with no identity in them
    apply_referral_reward  — spends months and grants the access in one step

  Conversion (`convert_referral`) is not here. It is written by the Stripe
  webhook with the service key, because "this person started paying" is a claim
  only the payment processor gets to make — see lib/billing/stripe.ts.

  Demo mode keeps the same shapes in memory. It is a single identity, so it
  seeds a small, obviously-fictional history and says so in the interface.
*/

interface DemoReferralDB {
  code: string;
  visits: number;
  referrals: Referral[];
  rewards: Reward[];
  seq: number;
}

const g = globalThis as unknown as { __midoRefDB?: DemoReferralDB };

function demoDB(): DemoReferralDB {
  return (g.__midoRefDB ??= seedDemo());
}

function seedDemo(): DemoReferralDB {
  const day = 864e5;
  const now = Date.now();
  const at = (d: number) => new Date(now - d * day).toISOString();
  return {
    code: "MDX7KP",
    visits: 34,
    referrals: [
      { id: "r1", status: "converted", joinedAt: at(41), convertedAt: at(38), tier: "pro" },
      { id: "r2", status: "converted", joinedAt: at(22), convertedAt: at(19), tier: "elite" },
      { id: "r3", status: "pending", joinedAt: at(9), convertedAt: null, tier: null },
      { id: "r4", status: "pending", joinedAt: at(3), convertedAt: null, tier: null },
    ],
    rewards: [
      { id: "w1", status: "applied", months: 1, earnedAt: at(24), appliedAt: at(20) },
      { id: "w2", status: "earned", months: 1, earnedAt: at(5), appliedAt: null },
    ],
    seq: 5,
  };
}

// ── reading ──────────────────────────────────────────────────

/** The caller's code, minting one on first ask. Null when signed out. */
export async function myReferralCode(): Promise<string | null> {
  if (isDemoMode) return demoDB().code;

  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("my_referral_code");
  if (error) return null;
  return (data as string) ?? null;
}

export async function getReferralOverview(): Promise<ReferralOverview> {
  if (isDemoMode) {
    const db = demoDB();
    return {
      code: { code: db.code, createdAt: new Date(Date.now() - 60 * 864e5).toISOString() },
      stats: statsFrom(db.referrals, db.rewards, db.visits),
      referrals: db.referrals,
      rewards: db.rewards,
    };
  }

  const supabase = await createClient();
  if (!supabase) return emptyOverview();

  // Ensure a code exists before reading, so a first visit shows a link rather
  // than an empty state that needs a second click to fix.
  await supabase.rpc("my_referral_code");
  // Opportunistic ripening: held conversions become rewards when someone looks.
  // Cheap, idempotent, and it means the programme works without a cron job.
  await supabase.rpc("ripen_referral_rewards");

  const { data, error } = await supabase.rpc("my_referrals");
  if (error || !data) return emptyOverview();

  const row = data as {
    code: string | null;
    visits: number;
    referrals: Referral[];
    rewards: Reward[];
  };
  const referrals = row.referrals ?? [];
  const rewards = row.rewards ?? [];

  return {
    code: row.code ? { code: row.code, createdAt: "" } : null,
    stats: statsFrom(referrals, rewards, Number(row.visits) || 0),
    referrals,
    rewards,
  };
}

function emptyOverview(): ReferralOverview {
  return {
    code: null,
    stats: { visits: 0, signups: 0, conversions: 0, monthsEarned: 0, monthsAvailable: 0 },
    referrals: [],
    rewards: [],
  };
}

/** The full link to hand out. */
export async function myReferralLink(): Promise<string | null> {
  const code = await myReferralCode();
  return code ? referralUrl(code, env.appUrl) : null;
}

// ── writing ──────────────────────────────────────────────────

/** Count an opened link. Never throws — a broken counter must not break a page. */
export async function recordVisit(code: string): Promise<void> {
  const c = normaliseReferralCode(code);
  if (!isPlausibleReferralCode(c)) return;

  if (isDemoMode) {
    demoDB().visits += 1;
    return;
  }
  const supabase = await createClient();
  if (!supabase) return;
  await supabase.rpc("record_referral_visit", { p_code: c });
}

/** Link the freshly-created account to a code. Safe to call more than once. */
export async function attributeReferral(
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const c = normaliseReferralCode(code);
  if (!isPlausibleReferralCode(c)) {
    return { ok: false, error: "That referral code is not recognised." };
  }

  if (isDemoMode) {
    // One identity in demo, so there is nobody else to be referred by. Say so
    // rather than pretending a link was made.
    return { ok: false, error: "Demo mode has a single account — referrals need a real signup." };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected." };
  const { data, error } = await supabase.rpc("attribute_referral", { p_code: c });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok?: boolean; error?: string };
  return { ok: Boolean(res.ok), error: res.error };
}

/** Spend earned months. Returns how many were applied. */
export async function applyRewards(
  months?: number,
): Promise<{ ok: boolean; months?: number; error?: string }> {
  if (isDemoMode) {
    const db = demoDB();
    const spend = db.rewards.filter((r) => r.status === "earned").slice(0, months ?? 999);
    if (spend.length === 0) return { ok: false, error: "You have no unspent months." };
    const now = new Date().toISOString();
    for (const r of spend) {
      r.status = "applied";
      r.appliedAt = now;
    }
    return { ok: true, months: spend.reduce((n, r) => n + r.months, 0) };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Not connected." };
  const { data, error } = await supabase.rpc("apply_referral_reward", {
    p_months: months ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const res = (data ?? {}) as { ok?: boolean; months?: number; error?: string };
  return { ok: Boolean(res.ok), months: res.months, error: res.error };
}

/**
 * Comped Pro time still running on the caller's account, if any. Read by the
 * membership layer so a spent reward is a real entitlement, not a dashboard
 * number.
 */
export async function activeComp(): Promise<{ tier: "pro" | "elite"; endsAt: string } | null> {
  if (isDemoMode) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("comped_access")
    .select("tier, ends_at")
    .gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { tier: (data.tier as "pro" | "elite") ?? "pro", endsAt: String(data.ends_at) };
}

/** Exposed for the demo/dev seed and for tests that need a plausible code. */
export { generateReferralCode, REWARD };
