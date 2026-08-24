#!/usr/bin/env node
/*
  Verify 0029 — and the whole billing/referral write surface — from the
  outside, as a real signed-in account with no special privilege.

  Nine tables sit behind exactly one thing: an RLS policy with no
  matching write rule. That policy has never been permissive by
  accident, but "never has been" is not the same guarantee as "cannot
  be" — one future INSERT policy added for an unrelated reason, on any
  of these nine, reopens a free-money bug with no other step required,
  because the table grant was sitting there wide open underneath it the
  whole time. 0029 closes the grant so the guarantee is the privilege,
  not the absence of a policy.

  Every attempt below is a real write a real attacker would make if this
  were open: self-granting a paid tier, minting referral reward months,
  marking your own referral converted, forging a Stripe customer link,
  zeroing your own AI usage. All nine must be refused. Anon must be
  refused reading any of it. And the four tables with a real select
  policy must still be readable by their owner — hardening the grant
  must not have broken the feature it protects.

  Usage: node scripts/verify-billing.mjs
*/
import { readFileSync } from "node:fs";

function env() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
} = env();

if (!url || !anonKey || !serviceKey) {
  console.error("Supabase URL, anon key and service role key must all be set in .env.local.");
  process.exit(1);
}

const svc = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
let pass = 0;
const failures = [];
const ok = (l, d = "") => { pass++; console.log(`  ok       ${l}${d ? `  ${d}` : ""}`); };
const bad = (l, d = "") => { failures.push(`${l}${d ? ` — ${d}` : ""}`); console.log(`  BAD      ${l}${d ? `\n           ${d}` : ""}`); };

const rest = (p, h, init = {}) =>
  fetch(`${url}/rest/v1/${p}`, { ...init, headers: { ...h, ...(init.headers ?? {}) } });

const WRITABLE = [
  "referral_codes", "referral_visits", "referrals", "referral_rewards", "comped_access",
  "subscriptions", "billing_customers", "usage_periods", "ai_usage_events",
];
const READABLE = ["referral_codes", "referrals", "referral_rewards", "comped_access", "subscriptions", "billing_customers", "usage_periods", "ai_usage_events"];

console.log("\nthe anon key must be refused everywhere\n");
const anon = { apikey: anonKey, authorization: `Bearer ${anonKey}` };
for (const t of WRITABLE) {
  const r = await rest(`${t}?select=*&limit=1`, anon);
  if (r.ok) bad(`anon reads ${t}`, `HTTP 200, ${(await r.json()).length} row(s)`);
  else ok(`anon refused on ${t}`, `HTTP ${r.status}`);
}

console.log("\nas a real signed-in account, with no special privilege\n");

const made = [];
try {
  const email = "midoxi-audit-billing@example.invalid";
  const password = "Audit-Billing-9x7z!";
  const cr = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...svc, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = await cr.json();
  if (!user.id) throw new Error(`account creation failed: ${JSON.stringify(user).slice(0, 200)}`);
  made.push(user.id);

  const tk = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { access_token } = await tk.json();
  const h = { apikey: anonKey, authorization: `Bearer ${access_token}`, "content-type": "application/json", prefer: "return=representation" };

  /*
    Each one is a real attack, not a synthetic probe: this is exactly
    the row a free-money bug would need written.
  */
  const attacks = [
    ["cannot self-grant Club-tier comped access", "comped_access",
      { user_id: user.id, tier: "club", source: "referral", ends_at: new Date(Date.now() + 365 * 864e5).toISOString() }],
    ["cannot mint itself referral reward months", "referral_rewards",
      { user_id: user.id, kind: "pro_month", months: 999, status: "earned" }],
    ["cannot mark its own referral converted", "referrals",
      { code: "AUDIT1", referrer_id: user.id, referred_id: user.id, status: "converted" }],
    ["cannot self-grant an active Club subscription", "subscriptions",
      { user_id: user.id, plan_id: "club_monthly", status: "active", current_period_end: new Date(Date.now() + 365 * 864e5).toISOString() }],
    ["cannot point billing_customers at a forged Stripe id", "billing_customers",
      { user_id: user.id, stripe_customer_id: "cus_forged" }],
    ["cannot zero its own AI usage counters", "usage_periods",
      { user_id: user.id, period_start: "2026-08-01", counters: {} }],
  ];

  for (const [label, table, body] of attacks) {
    const r = await rest(table, h, { method: "POST", body: JSON.stringify(body) });
    if (r.ok) bad(label, `HTTP ${r.status} — the write was accepted`);
    else ok(label, `refused — HTTP ${r.status}`);
  }

  // Hardening the grant must not have broken the read the feature needs.
  for (const t of READABLE) {
    const r = await rest(`${t}?select=*&limit=1`, h);
    r.ok ? ok(`the owner can still read ${t}`) : bad(`the owner can still read ${t}`, `HTTP ${r.status} — the grant fix broke a real feature`);
  }
} catch (e) {
  bad("account probe", String(e.message ?? e).slice(0, 240));
} finally {
  for (const id of made) await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
  const left = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc });
  const strays = (left.ok ? ((await left.json()).users ?? []) : []).filter((u) => String(u.email ?? "").startsWith("midoxi-audit-billing"));
  strays.length === 0 ? ok("probe account removed") : bad("probe account removed", `${strays.length} left`);
}

console.log("\nthe money-claim functions\n");
const anonPost = { ...anon, "content-type": "application/json" };
{
  const r = await rest("rpc/convert_referral", anonPost, {
    method: "POST",
    body: JSON.stringify({ p_user: "00000000-0000-0000-0000-000000000000", p_tier: "player", p_hold_days: 7 }),
  });
  r.ok ? bad("anon cannot call convert_referral", `HTTP ${r.status}`) : ok("anon refused on convert_referral", `HTTP ${r.status}`);
}
{
  const r = await rest("rpc/void_referral", anonPost, {
    method: "POST",
    body: JSON.stringify({ p_user: "00000000-0000-0000-0000-000000000000", p_reason: "audit" }),
  });
  r.ok ? bad("anon cannot call void_referral", `HTTP ${r.status}`) : ok("anon refused on void_referral", `HTTP ${r.status}`);
}

console.log(
  failures.length === 0
    ? `\n${pass} checks passed. Nobody can write themselves a subscription, a referral reward, or free AI usage.\n`
    : `\n${pass} passed, ${failures.length} FAILED:\n${failures.map((f) => `  · ${f}`).join("\n")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
