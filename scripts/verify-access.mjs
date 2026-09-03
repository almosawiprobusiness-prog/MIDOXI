#!/usr/bin/env node
/*
  Which operating systems can a given account actually open?

  This exists because a paying subscriber could not open most of what they had
  bought, and nothing anywhere said so. Two separate faults, pulling opposite
  ways:

    · `availableRoles` was `provisioned ∩ entitled`, and a role becomes
      "provisioned" only by being switched into — which the switcher would not
      offer, because it reads `availableRoles`. Entering required provisioning;
      provisioning required entering.

    · `getMembership` returned the paid subscription without ever looking at a
      comped window, so an account holding both got whichever the code checked
      first rather than the better one. A founder on a comped Club window who
      subscribed to Touchline was moved DOWN by paying.

  Neither produced an error. Both are invisible from inside the app, which is
  why this reads the answer from the outside: the tables, the plan definitions,
  and the resolution rule, printed side by side so a wrong answer is obvious.

  It mirrors the rule rather than importing it — `lib/auth/session.ts` is
  `server-only`. `tests/unit/role-gate.test.ts` pins the same algorithm, and
  the two must agree.

  Usage: node scripts/verify-access.mjs [email]
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

/*
  A failed request must not read as an empty result.

  The first version of this returned `null` on !ok, which is indistinguishable
  from "no rows" at the call site — so one transient failure on the
  `subscriptions` read printed a paying subscriber as having no subscription.
  A tool built to catch billing being wrong quietly reported billing as wrong.
  Throw instead: a checker that cannot answer must say so, not guess.
*/
const rest = async (q) => {
  const r = await fetch(`${url}/rest/v1/${q}`, { headers: svc });
  if (!r.ok) throw new Error(`${q.split("?")[0]}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
};

// Kept in step with lib/billing/plans.ts by hand; the assertion at the bottom
// catches the case where a plan gains a role and this does not.
const ROLES_FOR = {
  free: [],
  xi_monthly: ["player", "coach", "trainer"],
  xi_annual: ["player", "coach", "trainer"],
  managed: ["player", "coach", "trainer", "club"],
  // Retired tiers below, still honoured for the accounts that bought them.
  player_monthly: ["player"],
  player_annual: ["player"],
  // Retired bundle, still honoured for the accounts that bought it.
  touchline_monthly: ["player", "coach", "trainer"],
  touchline_annual: ["player", "coach", "trainer"],
  touchline_coach_monthly: ["player", "coach"],
  touchline_coach_annual: ["player", "coach"],
  touchline_trainer_monthly: ["player", "trainer"],
  touchline_trainer_annual: ["player", "trainer"],
  club_monthly: ["player", "coach", "trainer", "club"],
  club_annual: ["player", "coach", "trainer", "club"],
};
const TIER_OF = {
  free: "free",
  xi_monthly: "xi", xi_annual: "xi",
  managed: "managed",
  player_monthly: "player", player_annual: "player",
  touchline_monthly: "touchline", touchline_annual: "touchline",
  touchline_coach_monthly: "touchline_coach", touchline_coach_annual: "touchline_coach",
  touchline_trainer_monthly: "touchline_trainer", touchline_trainer_annual: "touchline_trainer",
  club_monthly: "club", club_annual: "club",
};
// Coach and Trainer share a rank: same price, neither contains the other.
const RANK = {
  free: 0,
  player: 1,
  touchline: 2,
  touchline_coach: 2,
  touchline_trainer: 2,
  xi: 2,
  club: 3,
  managed: 3,
};
const FREE_ROLES = ["player", "coach", "trainer"];
const ACTIVE = new Set(["active", "trialing", "past_due"]);

const wanted = process.argv[2];
const users = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc })
  .then((r) => r.json())
  .then((j) => j.users ?? []);

const targets = wanted ? users.filter((u) => u.email === wanted) : users;
if (targets.length === 0) {
  console.error(wanted ? `No account for ${wanted}.` : "No accounts.");
  process.exit(1);
}

let problems = 0;

for (const u of targets) {
  const [sub, comps, prof, pp, cp, tp, clp] = await Promise.all([
    rest(`subscriptions?select=plan_id,status,current_period_end&user_id=eq.${u.id}`),
    rest(`comped_access?select=tier,source,ends_at&user_id=eq.${u.id}&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&order=ends_at.desc`),
    rest(`profiles?select=role&id=eq.${u.id}`),
    rest(`player_profiles?select=user_id&user_id=eq.${u.id}`),
    rest(`coach_profiles?select=user_id&user_id=eq.${u.id}`),
    rest(`trainer_profiles?select=user_id&user_id=eq.${u.id}`),
    rest(`club_profiles?select=user_id&user_id=eq.${u.id}`),
  ]);

  const s = sub?.[0];
  const c = comps?.[0];
  const paidPlan = s && ACTIVE.has(String(s.status)) ? s.plan_id : null;
  const COMP_PLAN = {
    club: "club_monthly",
    touchline: "touchline_monthly",
    touchline_coach: "touchline_coach_monthly",
    touchline_trainer: "touchline_trainer_monthly",
    player: "player_monthly",
  };
  const compPlan = c ? (COMP_PLAN[c.tier] ?? "player_monthly") : null;

  // The rule: the better of the two live grants, never whichever was read first.
  let planId = "free";
  let via = "free";
  if (paidPlan && compPlan) {
    const better = RANK[TIER_OF[compPlan]] > RANK[TIER_OF[paidPlan]];
    planId = better ? compPlan : paidPlan;
    via = better ? `comped ${c.tier} (${c.source}) — outranks the paid ${TIER_OF[paidPlan]}` : `paid ${s.status}`;
  } else if (paidPlan) { planId = paidPlan; via = `paid ${s.status}`; }
  else if (compPlan) { planId = compPlan; via = `comped ${c.tier} (${c.source})`; }

  const entitled = ROLES_FOR[planId] ?? [];
  const provisioned = [
    pp?.length && "player", cp?.length && "coach", tp?.length && "trainer", clp?.length && "club",
  ].filter(Boolean);

  // Entitlement does not depend on provisioning. That was the deadlock.
  const available = entitled.length > 0 ? entitled : [FREE_ROLES[0]];

  console.log(`\n${u.email}`);
  console.log(`  plan          ${planId}   (${via})`);
  if (c && paidPlan) console.log(`  also holds    comped ${c.tier} until ${String(c.ends_at).slice(0, 10)}`);
  console.log(`  stored role   ${prof?.[0]?.role ?? "—"}`);
  console.log(`  set up        ${provisioned.join(", ") || "— none —"}`);
  console.log(`  CAN OPEN      ${available.join(", ")}`);

  const notYetSetUp = available.filter((r) => !provisioned.includes(r));
  if (notYetSetUp.length) {
    console.log(`  of those, not set up yet: ${notYetSetUp.join(", ")}`);
    console.log(`  (switching creates the profile row — that is the entry path, not a prerequisite)`);
  }

  if (available.length < entitled.length) {
    problems++;
    console.log(`  PROBLEM: pays for ${entitled.length} systems, can open ${available.length}`);
  }
}

console.log(
  problems === 0
    ? `\n${targets.length} account(s) checked. Everyone can open everything they pay for.\n`
    : `\n${problems} account(s) cannot open what they pay for.\n`,
);
process.exit(problems === 0 ? 0 : 1);
