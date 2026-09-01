#!/usr/bin/env node
/*
  Give an account paid-tier access, at no charge.

  The general form of `grant-owner-access.mjs`, which grants exactly one
  thing (Club, forever, source "founder") because that is all an owner
  grant ever needs. This one takes the tier, the window and the label, so
  a beta tester on Player for three months and a comped client on
  Touchline are the same operation rather than hand-written SQL each time.

  Not a backdoor. It writes an ordinary `comped_access` row — the same
  mechanism a referral reward uses — which `getMembership()` has always
  read as a real entitlement alongside the Stripe subscription, taking
  the better of the two. So a comp applies whether or not the person has
  ever touched Stripe, needs no card, and survives whatever happens to a
  subscription they may later buy.

  WHY NOT TOUCH `subscriptions`. That table is webhook-owned: Stripe is
  its source of truth and the next `customer.subscription.*` event
  overwrites whatever was put there by hand. A grant written here is
  never in a race with Stripe.

  IDEMPOTENT PER SOURCE. Re-running with the same --source updates that
  row rather than stacking duplicates. Different sources coexist on
  purpose: a founder grant and a temporary campaign comp are different
  facts, and `getMembership()` reads the furthest-future row.

  Usage:
    node scripts/comp.mjs someone@example.com                       player, no expiry
    node scripts/comp.mjs someone@example.com --tier touchline
    node scripts/comp.mjs someone@example.com --months 3
    node scripts/comp.mjs someone@example.com --source beta-invite
    node scripts/comp.mjs someone@example.com --revoke              removes this source's grant
    node scripts/comp.mjs --list                                    every live comp
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

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = env();
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}

const svc = { apikey: key, authorization: `Bearer ${key}` };
const json = { ...svc, "content-type": "application/json" };

const rest = async (path, init) => {
  const r = await fetch(`${url}/rest/v1/${path}`, init ?? { headers: svc });
  if (!r.ok) throw new Error(`${path.split("?")[0]}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
};

/* ── arguments ─────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] ?? fallback);
};
const has = (name) => argv.includes(`--${name}`);

/* Mirrors the check constraint migration 0013 put on the column. A tier
   this script would accept but the database refuses is a failure that
   should happen here, with a readable message, not as a 400 from PostgREST. */
const TIERS = ["player", "touchline", "club"];

/*
  `ends_at` is NOT NULL, so a date is the only way to say "no expiry".
  Same sentinel `grant-owner-access.mjs` uses: obviously deliberate
  rather than a number that looks computed.
*/
const FOREVER = "2099-12-31T00:00:00.000Z";

if (has("list")) {
  const rows = await rest(
    "comped_access?select=user_id,tier,source,starts_at,ends_at&order=ends_at.desc",
  );
  const live = rows.filter((r) => Date.parse(r.ends_at) > Date.now());
  if (!live.length) {
    console.log("\nNo live comped access.\n");
    process.exit(0);
  }
  const usersRes = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers: svc });
  const users = usersRes.ok ? ((await usersRes.json()).users ?? []) : [];
  const emailOf = (id) => users.find((u) => u.id === id)?.email ?? id;
  console.log(`\n${live.length} live grant${live.length === 1 ? "" : "s"}\n`);
  for (const r of live) {
    const until = Date.parse(r.ends_at) >= Date.parse(FOREVER) ? "no expiry" : String(r.ends_at).slice(0, 10);
    console.log(`  ${emailOf(r.user_id).padEnd(32)} ${r.tier.padEnd(10)} ${String(r.source).padEnd(14)} until ${until}`);
  }
  console.log("\nWhere one account holds several, getMembership() reads the furthest-future row.\n");
  process.exit(0);
}

const email = argv[0];
if (!email || email.startsWith("--")) {
  console.error("Usage: node scripts/comp.mjs <email> [--tier player|touchline|club] [--months N] [--source label] [--revoke]");
  console.error("       node scripts/comp.mjs --list");
  process.exit(1);
}

const tier = String(flag("tier", "player")).toLowerCase();
if (!TIERS.includes(tier)) {
  console.error(`--tier must be one of: ${TIERS.join(", ")}`);
  process.exit(1);
}

const monthsRaw = flag("months");
let months = null;
if (monthsRaw !== null) {
  months = Number(monthsRaw);
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    console.error("--months must be a whole number between 1 and 120.");
    process.exit(1);
  }
}

const source = String(flag("source", "manual"));
const revoke = has("revoke");

/* ── find the account ──────────────────────────────────────── */

const usersRes = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers: svc });
if (!usersRes.ok) {
  console.error(`Could not list accounts: ${(await usersRes.text()).slice(0, 200)}`);
  process.exit(1);
}
const user = ((await usersRes.json()).users ?? []).find(
  (u) => String(u.email ?? "").toLowerCase() === email.toLowerCase(),
);
if (!user) {
  console.error(`No account found for ${email}. They must sign up before a grant can attach to them.`);
  process.exit(1);
}

const existing = (
  await rest(`comped_access?select=id,tier,ends_at&user_id=eq.${user.id}&source=eq.${encodeURIComponent(source)}`)
)[0];

/* ── revoke ────────────────────────────────────────────────── */

if (revoke) {
  if (!existing) {
    console.log(`\n${email} has no "${source}" grant to remove.\n`);
    process.exit(0);
  }
  await rest(`comped_access?id=eq.${existing.id}`, { method: "DELETE", headers: svc });
  const left = await rest(`comped_access?select=tier,source,ends_at&user_id=eq.${user.id}`);
  const stillLive = left.filter((r) => Date.parse(r.ends_at) > Date.now());
  console.log(`\nRemoved the "${source}" grant from ${email}.`);
  if (stillLive.length) {
    console.log(`They still hold: ${stillLive.map((r) => `${r.tier} (${r.source})`).join(", ")}`);
  }
  console.log("Any paid subscription they hold is untouched and still applies.\n");
  process.exit(0);
}

/* ── grant ─────────────────────────────────────────────────── */

const startsAt = new Date();
const endsAt = months === null ? FOREVER : (() => {
  const d = new Date(startsAt);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
})();

if (existing) {
  await rest(`comped_access?id=eq.${existing.id}`, {
    method: "PATCH",
    headers: { ...json, prefer: "return=representation" },
    body: JSON.stringify({ tier, ends_at: endsAt }),
  });
} else {
  await rest("comped_access", {
    method: "POST",
    headers: { ...json, prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      tier,
      source,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt,
    }),
  });
}

/*
  Read it back rather than trust the write's own response, and compare
  dates as INSTANTS — Postgres returns `2099-12-31T00:00:00+00:00` where
  this file wrote `2099-12-31T00:00:00.000Z`. The same moment, spelled
  differently; a string `!==` between them reports a grant that landed
  as a failure.
*/
const rows = await rest(
  `comped_access?select=tier,source,ends_at&user_id=eq.${user.id}&order=ends_at.desc`,
);
const mine = rows.find((r) => r.source === source);
if (!mine || mine.tier !== tier || Date.parse(mine.ends_at) !== Date.parse(endsAt)) {
  console.error(`\nThe grant did not take. Current rows: ${JSON.stringify(rows)}\n`);
  process.exit(1);
}

/* What the app will actually resolve — the furthest-future row wins,
   which is not necessarily the one just written. */
const winner = rows[0];

console.log(`\n${email}`);
console.log(`  ${existing ? "updated" : "granted"}   ${tier} tier, source "${source}"`);
console.log(`  until      ${months === null ? "no expiry" : `${String(endsAt).slice(0, 10)} (${months} month${months === 1 ? "" : "s"})`}`);
if (winner.source !== source) {
  console.log(`  NOTE       a "${winner.source}" grant of ${winner.tier} runs later and takes precedence.`);
}
console.log(`\ngetMembership() takes the better of comped and paid, so this applies`);
console.log(`whatever happens to any Stripe subscription on the account.\n`);
console.log(`Confirm what the app now resolves with:  node scripts/verify-access.mjs ${email}\n`);
