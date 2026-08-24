#!/usr/bin/env node
/*
  Has every migration in the folder actually been RUN?

  This script exists because the answer turned out to be no. 0023 opened with
  `alter table community_posts` and failed — relation does not exist. 0003 had
  never been run against the production database. The community section had
  only ever worked in demo mode, which serves an in-memory store and never
  touches Postgres, so every route rendered, every test passed, and the three
  tables underneath them did not exist. Nothing anywhere reported a problem.

  There is no migration ledger here — migrations are pasted into the Supabase
  SQL editor by hand, so there is no `schema_migrations` table to consult and
  no record of what ran. The only honest way to answer the question is to read
  what the files CLAIM to create and check the database for each one.

  That is what this does: parse every `create table` / `create view` out of
  supabase/migrations, ask PostgREST for each relation, and report the misses
  grouped by the file that declares them — so the output names the migration to
  go and run, not just the table that is missing.

  Limits worth knowing, because a green result here is narrower than it looks:
    · It checks RELATIONS only. A migration that just adds a column, grants a
      role, or creates a function is invisible to it. verify-columns.mjs and
      verify-security.mjs cover those.
    · It proves a table EXISTS, not that it has the right shape.

  Usage: node scripts/verify-migrations.mjs
*/
import { readFileSync, readdirSync } from "node:fs";

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

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

/*
  Which file to blame for a relation: the FIRST one that declares it. A later
  migration may `create table if not exists` the same name defensively, and
  pointing at that one would send somebody to run a file that is not the gap.
*/
const declaredBy = new Map();
const pattern = /create\s+(?:or\s+replace\s+)?(table|view|materialized\s+view)\s+(?:if\s+not\s+exists\s+)?([a-z0-9_.]+)/gi;

/*
  Comments are not DDL.

  These files explain themselves at length and quote SQL while doing it — 0019
  discusses "`create table if not exists`" in prose, describing the very trap it
  fell into. Parsed naively that reads as a table called `if`, and the first
  version of this script duly reported one missing. A checker that invents work
  is worse than no checker, because the one real finding gets lost in the noise.
*/
const stripComments = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");

for (const file of files) {
  const sql = stripComments(readFileSync(new URL(file, dir), "utf8"));
  for (const m of sql.matchAll(pattern)) {
    const kind = m[1].toLowerCase().replace(/\s+/g, " ");
    const name = m[2].replace(/^public\./, "");
    // Other schemas are not ours to create and are not reachable over REST.
    if (name.includes(".")) continue;
    if (!declaredBy.has(name)) declaredBy.set(name, { file, kind });
  }
}

const missing = new Map();
const unknown = [];
let present = 0;

/*
  ONLY a 404 means the table is not there.

  The first version treated every non-ok response as missing and fired all
  eighty requests at once. One of them got throttled, and the script
  reported `training_logs` — declared in 0001 and present since the first
  day — as a migration that had never been run. A checker that invents a
  failure is worse than one that misses a real one: it sends somebody to
  re-run a migration against a database that already has it.

  So the states are kept apart. 404 with PGRST205 is absent. Anything
  else is "could not determine", retried once, and then reported as
  UNKNOWN rather than folded into the answer.
*/
async function probe(name) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${url}/rest/v1/${name}?select=*&limit=0`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (res.ok) return { state: "present" };

    const body = await res.text();
    // PGRST205: "Could not find the table ... in the schema cache".
    if (res.status === 404 && body.includes("PGRST205")) return { state: "absent" };

    // Anything else — throttling, a gateway blip, an auth problem — is not
    // evidence of absence. Back off and ask again.
    if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    else return { state: "unknown", detail: `HTTP ${res.status} ${body.slice(0, 120)}` };
  }
  return { state: "unknown", detail: "exhausted retries" };
}

// Serial, in small batches. Eighty parallel requests is what caused the
// throttling in the first place, and this script is never in a hurry.
const entries = [...declaredBy];
for (let i = 0; i < entries.length; i += 6) {
  const batch = entries.slice(i, i + 6);
  const results = await Promise.all(batch.map(([name]) => probe(name)));
  batch.forEach(([name, { file, kind }], j) => {
    const r = results[j];
    if (r.state === "present") present++;
    else if (r.state === "absent") {
      if (!missing.has(file)) missing.set(file, []);
      missing.get(file).push(`${name} (${kind})`);
    } else {
      unknown.push(`${name} (${file}) — ${r.detail}`);
    }
  });
}

console.log(`\n${declaredBy.size} relations declared across ${files.length} migrations.`);

if (unknown.length > 0) {
  console.log(`\n${unknown.length} could NOT be determined — treat this run as inconclusive:\n`);
  for (const u of unknown) console.log(`  ? ${u}`);
  console.log("");
}

if (missing.size === 0) {
  console.log(`All ${present} that could be checked are present.\n`);
  console.log("Note: this proves the tables EXIST, not that their columns are right,");
  console.log("and it says nothing about column-only or grant-only migrations.");
  console.log("Run `npm run verify:db` for those.\n");
  // An inconclusive run is not a pass. Exiting 0 here would let CI go green
  // on a check that never actually answered the question.
  process.exit(unknown.length === 0 ? 0 : 2);
}

const absent = [...missing.values()].reduce((n, v) => n + v.length, 0);
console.log(`${present} present, ${absent} MISSING.\n`);
console.log("These migrations look like they were never run:\n");
for (const [file, names] of [...missing].sort()) {
  console.log(`  ${file}`);
  for (const n of names) console.log(`      ${n}`);
  console.log("");
}
console.log("Run them in the Supabase SQL editor, oldest first, then re-run this.\n");
process.exit(1);
