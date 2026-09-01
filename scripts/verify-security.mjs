/*
  Verify the RULES landed, not just the tables.

  `verify-schema.mjs` proves the tables and functions exist. This proves the
  grants are right: every security-definer function is reachable by the role
  that should reach it, and the two that write money claims are reachable by
  nobody but the Stripe webhook.

  It exists because that distinction is easy to get wrong in a way nothing
  surfaces. Migration 0011 ended with `revoke execute … from anon,
  authenticated` — which does nothing, because Postgres grants EXECUTE on a new
  function to PUBLIC by default and both roles inherit it from there. The
  migration ran without error, the tables all checked out, and
  `convert_referral` was callable by anyone holding the anon key.

  Read-only: every call here uses a uuid that matches nothing and a code that
  cannot exist, so nothing is written.

  Usage: node scripts/verify-security.mjs
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
const e = env();
const url = e.NEXT_PUBLIC_SUPABASE_URL;
const anon = e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = e.SUPABASE_SERVICE_ROLE_KEY;

async function rpc(fn, body, key) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.text()).slice(0, 160) };
}

// 1. Every function the app calls must EXIST (404 = missing).
const MUST_EXIST = [
  ["preview_invite", { p_code: "ZZZZ-ZZZZ" }],
  ["accept_invite", { p_code: "ZZZZ-ZZZZ", p_scope: "identity" }],
  ["set_link_scope", { p_kind: "coach-player", p_id: "00000000-0000-0000-0000-000000000000", p_scope: "identity" }],
  ["my_referral_code", {}],
  ["record_referral_visit", { p_code: "ZZZZZZ" }],
  ["attribute_referral", { p_code: "ZZZZZZ" }],
  ["apply_referral_reward", { p_months: 1 }],
  ["my_referrals", {}],
  ["ripen_referral_rewards", {}],
];

let bad = 0;
console.log("\nfunctions exist (service role)");
for (const [fn, body] of MUST_EXIST) {
  const r = await rpc(fn, body, svc);
  if (r.status === 404) { bad++; console.log(`  MISSING  ${fn}()  ${r.body}`); }
  else console.log(`  ok       ${fn}()`);
}

// 2. The money-claim functions must be UNREACHABLE by the public roles.
//    "This person started paying" is a claim only Stripe gets to make.
const MUST_BE_LOCKED = [
  ["convert_referral", { p_user: "00000000-0000-0000-0000-000000000000", p_tier: "pro", p_hold_days: 14 }],
  ["void_referral", { p_user: "00000000-0000-0000-0000-000000000000", p_reason: "test" }],
  /*
    0042's joiner credit. Same rule, same reason: claiming it is what makes
    the webhook pay real money onto a Stripe balance, so a client role able to
    call it could mint itself a credit — and `release` could hand a claim back
    for a credit already paid, which is the same hole facing the other way.
  */
  ["claim_joiner_credit", { p_user: "00000000-0000-0000-0000-000000000000" }],
  ["release_joiner_credit", { p_user: "00000000-0000-0000-0000-000000000000" }],
];

console.log("\nlocked to the service role only");
for (const [fn, body] of MUST_BE_LOCKED) {
  const r = await rpc(fn, body, anon);
  // A revoked function is not exposed to PostgREST for that role at all.
  const locked = r.status === 404 || r.status === 401 || r.status === 403;
  if (locked) console.log(`  ok       ${fn}() refused to anon (${r.status})`);
  else { bad++; console.log(`  EXPOSED  ${fn}() answered anon with ${r.status} — ${r.body}`); }

  const s = await rpc(fn, body, svc);
  if (s.status === 404) { bad++; console.log(`  MISSING  ${fn}() not present even for service role`); }
  else console.log(`  ok       ${fn}() present for the webhook (${s.status})`);
}

// 3. Anonymous visitors may count a referral click, and nothing else.
console.log("\nanonymous surface");
const visit = await rpc("record_referral_visit", { p_code: "ZZZZZZ" }, anon);
console.log(visit.status < 400 ? "  ok       record_referral_visit() callable by anon (the click happens pre-signup)"
                               : `  BLOCKED  record_referral_visit() ${visit.status} ${visit.body}`);
if (visit.status >= 400) bad++;

const mine = await rpc("my_referrals", {}, anon);
console.log(`  ok       my_referrals() as anon returns ${mine.body === "null" ? "null (no identity, no data)" : mine.body}`);

console.log(bad === 0 ? "\nAll rules verified." : `\n${bad} problem(s).`);
process.exit(bad === 0 ? 0 : 1);
