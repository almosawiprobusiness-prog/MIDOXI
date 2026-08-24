#!/usr/bin/env node
/*
  Give an account permanent Club-tier access, at no charge.

  For the owner, and for anyone else who should never be billed — a
  co-founder, a long-term comp. Not a backdoor: it writes an ordinary
  `comped_access` row, the same mechanism a referral reward uses, which
  `getMembership()` has always read as a real entitlement alongside the
  Stripe subscription.

  WHY NOT AN EMAIL CHECK IN CODE. The obvious alternative is a
  `if (email === ownerEmail) return CLUB` branch somewhere in
  `getMembership()`. That would be a second, parallel definition of what
  somebody is entitled to, living outside the table every other part of
  billing reads — and the first thing to silently disagree with the
  membership page, the AI meter and the role gate the moment any of them
  changed. This grants access the way the product already understands
  access, so every one of those surfaces sees it without knowing anything
  new.

  WHY CLUB. It is the top tier: all four operating systems and the
  highest AI ceilings. An owner testing a Club-tier bug on a Player-tier
  account cannot see what their customer is seeing.

  IDEMPOTENT. Re-running updates the existing founder row rather than
  stacking duplicates — `getMembership()` reads the furthest-future row,
  so duplicates would not break anything, but a table full of them makes
  the next person wonder which one is real.

  Usage:  node scripts/grant-owner-access.mjs you@example.com
          node scripts/grant-owner-access.mjs you@example.com --revoke
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

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");
if (!email || email.startsWith("--")) {
  console.error("Usage: node scripts/grant-owner-access.mjs <email> [--revoke]");
  process.exit(1);
}

const svc = { apikey: key, authorization: `Bearer ${key}` };
const json = { ...svc, "content-type": "application/json" };

/*
  Far enough away to mean "not a question anybody has to revisit", and an
  obviously deliberate date rather than a number that looks computed.
  `ends_at` is NOT NULL, so a date is the only way to say forever.
*/
const FOREVER = "2099-12-31T00:00:00.000Z";
const SOURCE = "founder";

// -- find the account --------------------------------------------------
const usersRes = await fetch(`${url}/auth/v1/admin/users?per_page=500`, { headers: svc });
if (!usersRes.ok) {
  console.error(`Could not list accounts: ${(await usersRes.text()).slice(0, 200)}`);
  process.exit(1);
}
const user = ((await usersRes.json()).users ?? []).find(
  (u) => String(u.email ?? "").toLowerCase() === email.toLowerCase(),
);
if (!user) {
  console.error(`No account found for ${email}.`);
  process.exit(1);
}

// -- existing founder grant, if any -----------------------------------
const existingRes = await fetch(
  `${url}/rest/v1/comped_access?select=id,tier,ends_at&user_id=eq.${user.id}&source=eq.${SOURCE}`,
  { headers: svc },
);
const existing = existingRes.ok ? (await existingRes.json())[0] : null;

if (revoke) {
  if (!existing) {
    console.log(`\n${email} has no ${SOURCE} grant to remove.\n`);
    process.exit(0);
  }
  const del = await fetch(`${url}/rest/v1/comped_access?id=eq.${existing.id}`, {
    method: "DELETE",
    headers: svc,
  });
  if (!del.ok) {
    console.error(`Could not remove: ${(await del.text()).slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`\nRemoved the ${SOURCE} grant from ${email}.`);
  console.log("Any paid subscription they hold is untouched and still applies.\n");
  process.exit(0);
}

// -- grant or extend ---------------------------------------------------
let res;
if (existing) {
  res = await fetch(`${url}/rest/v1/comped_access?id=eq.${existing.id}`, {
    method: "PATCH",
    headers: { ...json, prefer: "return=representation" },
    body: JSON.stringify({ tier: "club", ends_at: FOREVER }),
  });
} else {
  res = await fetch(`${url}/rest/v1/comped_access`, {
    method: "POST",
    headers: { ...json, prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      tier: "club",
      source: SOURCE,
      starts_at: new Date().toISOString(),
      ends_at: FOREVER,
    }),
  });
}
if (!res.ok) {
  console.error(`Could not write the grant: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

/*
  Read it back rather than trust the write's own response — the habit
  this codebase has had to learn more than once.
*/
const check = await fetch(
  `${url}/rest/v1/comped_access?select=tier,source,ends_at&user_id=eq.${user.id}&order=ends_at.desc`,
  { headers: svc },
);
const rows = check.ok ? await check.json() : [];
const top = rows[0];

/*
  Compared as instants, not as strings. Postgres returns
  `2099-12-31T00:00:00+00:00` where this file wrote
  `2099-12-31T00:00:00.000Z` — the same moment, spelled differently, and
  a `!==` between them reported a grant that had in fact landed as a
  failure. A check that cries wolf is worth no more than one that sleeps
  through the alarm.
*/
const landed =
  top && top.tier === "club" && Date.parse(top.ends_at) === Date.parse(FOREVER);

if (!landed) {
  console.error(`\nThe grant did not take. Current rows: ${JSON.stringify(rows)}\n`);
  process.exit(1);
}

console.log(`\n${email}`);
console.log(`  ${existing ? "extended" : "granted"}   club tier, source "${SOURCE}"`);
console.log(`  until      ${String(top.ends_at).slice(0, 10)}`);
console.log(`  opens      Player, Coach, Trainer and Club — and the highest AI ceilings\n`);
console.log("getMembership() takes the better of comped and paid, so this applies");
console.log("whatever happens to any Stripe subscription on the account.\n");
console.log("Confirm what the app now resolves with:  npm run verify:access\n");
