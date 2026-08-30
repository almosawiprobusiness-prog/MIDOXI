#!/usr/bin/env node
/*
  Timeline parity — spec step 10, and deliberately nothing more.

  A read-only comparison of `player_timeline` (the view over ten domain
  tables) against what the event log (`mido_events`) holds for the same
  ground. It exists so that any future proposal to switch the Timeline
  from the view to the log starts from measurement instead of belief.
  The switch itself is on the stop-and-decide list; this script cannot
  perform it, only inform it.

  What "parity" means here, honestly:

    · The view is authoritative for WHAT EXISTS — including everything
      recorded before the event log existed. Rows in the view with no
      event are EXPECTED for any account older than migration 0031, and
      the report says how many, not "missing".
    · An event with no timeline row is the suspicious direction: the
      log claims something happened that the domain tables cannot show.
      Those are listed individually.

  Only the kinds both sides claim to cover are compared:

      view kind        event type
      match            MATCH_CREATED
      training         TRAINING_LOGGED
      checkin          PLAYER_CHECKIN_COMPLETED
      goal_set         GOAL_CREATED
      study_session*   STUDY_COMPLETED        (*completed = true only)
      analysis         VIDEO_ANALYZED

  Everything else in the view (clips, evidence, curated studies, goal
  milestones) has no event counterpart BY DESIGN and is reported as
  view-only coverage, so nobody reads its absence as loss.

  Usage: node scripts/timeline-parity.mjs
  Exit codes: 0 report produced · 1 config/connection failure ·
              2 mido_events missing (migration 0031 not applied)
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

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = env();
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

async function rows(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!res.ok) return { ok: false, status: res.status, body: await res.text() };
  return { ok: true, data: await res.json() };
}

const PAIRS = [
  { kind: "match", type: "MATCH_CREATED" },
  { kind: "training", type: "TRAINING_LOGGED" },
  { kind: "checkin", type: "PLAYER_CHECKIN_COMPLETED" },
  { kind: "goal_set", type: "GOAL_CREATED" },
  { kind: "study_session", type: "STUDY_COMPLETED", filter: (r) => r.meta?.completed === true },
  { kind: "analysis", type: "VIDEO_ANALYZED" },
];

const timeline = await rows("player_timeline?select=user_id,kind,ref_id,meta&limit=10000");
if (!timeline.ok) {
  console.error(`player_timeline unreadable (${timeline.status}): ${timeline.body?.slice(0, 200)}`);
  process.exit(1);
}

const events = await rows("mido_events?select=actor_user_id,type,subject_id,occurred_at&limit=10000");
if (!events.ok) {
  if (events.status === 404 || /relation .* does not exist/.test(events.body ?? "")) {
    console.error("mido_events does not exist — migration 0031 has not been applied.");
    console.error("There is nothing to compare yet. Apply 0031 (docs/beta/APPLY_MIGRATIONS.md) first.");
    process.exit(2);
  }
  console.error(`mido_events unreadable (${events.status}): ${events.body?.slice(0, 200)}`);
  process.exit(1);
}

const tRows = timeline.data;
const eRows = events.data;

console.log(`player_timeline: ${tRows.length} rows · mido_events: ${eRows.length} rows\n`);

const eventCoveredKinds = new Set(PAIRS.map((p) => p.kind));
const viewOnly = {};
for (const r of tRows) {
  if (!eventCoveredKinds.has(r.kind)) viewOnly[r.kind] = (viewOnly[r.kind] ?? 0) + 1;
}

let suspicious = 0;
console.log("kind            view   events   view-only*  event-only");
console.log("─".repeat(58));
for (const pair of PAIRS) {
  const inView = tRows.filter(
    (r) => r.kind === pair.kind && (!pair.filter || pair.filter(r)),
  );
  const inLog = eRows.filter((e) => e.type === pair.type);
  const viewIds = new Set(inView.map((r) => String(r.ref_id)));
  const logIds = new Set(inLog.map((e) => String(e.subject_id)));

  const viewOnlyCount = [...viewIds].filter((id) => !logIds.has(id)).length;
  const eventOnly = [...logIds].filter((id) => !viewIds.has(id));
  suspicious += eventOnly.length;

  console.log(
    `${pair.kind.padEnd(15)} ${String(inView.length).padStart(4)}   ${String(inLog.length).padStart(6)}   ${String(viewOnlyCount).padStart(9)}   ${String(eventOnly.length).padStart(9)}`,
  );
  for (const id of eventOnly.slice(0, 5)) {
    console.log(`    event-only ${pair.type}: subject ${id}`);
  }
}

console.log("\n* view-only = recorded before the event log existed, or the emitter");
console.log("  was not yet instrumented at the time. Expected; not a defect.");

const voKinds = Object.entries(viewOnly);
if (voKinds.length) {
  console.log("\nNot event-covered by design (view is the only source):");
  for (const [kind, n] of voKinds) console.log(`  ${kind}: ${n}`);
}

if (suspicious > 0) {
  console.log(`\n⚠ ${suspicious} event(s) with no timeline row — the log claims what the`);
  console.log("  domain tables cannot show. Investigate before trusting the log further.");
} else {
  console.log("\nNo event-only rows: nothing in the log that the record cannot back.");
}
console.log("\nThe view stays authoritative. Any switch proposal starts from this report.");
