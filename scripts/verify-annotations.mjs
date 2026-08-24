#!/usr/bin/env node
/*
  Verify 0030 — telestration — from the outside.

  Four things are worth proving rather than assuming here, and three of
  them are bugs this codebase has already had:

    · THE GRANT. Six migrations in this project have at some point
      revoked from anon and PUBLIC while `authenticated` — which holds
      ALL by Supabase default — quietly kept everything. So the anon key
      is pointed at the table and must be refused.

    · THE RLS BOUNDARY. Owner-only is the whole access model. It is
      checked as two real accounts rather than by reading the policy
      text, because a policy that reads correctly and a policy that
      behaves correctly are different claims.

    · THE EMPTY-DRAWING CONSTRAINT. `jsonb_array_length(shapes) > 0`
      only means something if an insert actually hits it. Proven with an
      insert, not by reading the catalogue.

    · THE CASCADE. Deleting a video must take its drawings with it.
      Otherwise every deleted match leaves orphan rows pointing at a
      video id that no longer resolves.

  The probe writes two obviously-synthetic accounts, a video and some
  drawings, then deletes everything and RE-LISTS rather than trusting
  the delete's own response.

  Usage: node scripts/verify-annotations.mjs [--no-probe]
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

if (!url || !serviceKey || !anonKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and");
  console.error("SUPABASE_SERVICE_ROLE_KEY must all be set in .env.local.");
  process.exit(1);
}

const PROBE = !process.argv.includes("--no-probe");

let pass = 0;
const failures = [];
function ok(label, detail = "") {
  pass++;
  console.log(`  ok       ${label}${detail ? `  ${detail}` : ""}`);
}
function bad(label, detail = "") {
  failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
  console.log(`  BAD      ${label}${detail ? `\n           ${detail}` : ""}`);
}

const svc = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
const rest = (path, headers = svc, init = {}) =>
  fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
const json = { "content-type": "application/json", prefer: "return=representation" };

const ARROW = { t: "arrow", c: "correction", w: 0.004, x1: 0.2, y1: 0.3, x2: 0.6, y2: 0.55 };

// ── 1 · the shape ────────────────────────────────────────────
console.log("\nwhat 0030 adds\n");

{
  const cols = "id, user_id, video_id, at_seconds, shapes, note, created_at, updated_at";
  const res = await rest(`video_annotations?select=${encodeURIComponent(cols)}&limit=0`);
  if (res.ok) ok("video_annotations", `(${cols.split(",").length} columns)`);
  else bad("video_annotations", (await res.text()).slice(0, 200));
}

// ── 2 · the grant ────────────────────────────────────────────
console.log("\nthe anon key must be refused\n");

{
  const anon = { apikey: anonKey, authorization: `Bearer ${anonKey}` };
  const res = await rest("video_annotations?select=*&limit=1", anon);
  if (res.ok) {
    const rows = await res.json();
    bad("anon reads video_annotations", `HTTP 200, ${rows.length} row(s) — the grant is open`);
  } else ok("anon refused on video_annotations", `HTTP ${res.status}`);
}

// ── 3 · two accounts, one drawing ────────────────────────────
if (PROBE) {
  console.log("\nowner-only, as two accounts\n");

  const made = [];
  const password = `probe-annotations-${"x".repeat(12)}`;
  const mkUser = async (tag) => {
    const email = `midoxi-ann-${tag}@example.invalid`;
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { ...svc, "content-type": "application/json" },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!res.ok) throw new Error(`${tag}: ${(await res.text()).slice(0, 160)}`);
    const u = await res.json();
    made.push(u.id);
    const tok = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!tok.ok) throw new Error(`${tag} sign-in: ${(await tok.text()).slice(0, 160)}`);
    const { access_token } = await tok.json();
    return { id: u.id, h: { apikey: anonKey, authorization: `Bearer ${access_token}` } };
  };

  let videoId = null;

  try {
    const [a, b] = [await mkUser("a"), await mkUser("b")];

    // A video to hang the drawings off. Created through the service role
    // so a failure here is never mistaken for a failure of 0030.
    const vid = await rest("videos", svc, {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        user_id: a.id,
        title: "verify-annotations probe",
        source: "url",
        external_url: "https://example.invalid/probe.mp4",
        status: "ready",
      }),
    });
    if (!vid.ok) throw new Error(`probe video: ${(await vid.text()).slice(0, 200)}`);
    videoId = (await vid.json())[0].id;

    // A draws.
    let annId = null;
    const mine = await rest("video_annotations", a.h, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ video_id: videoId, at_seconds: 42.5, shapes: [ARROW], note: "probe" }),
    });
    if (mine.ok) {
      annId = (await mine.json())[0].id;
      ok("a signed-in account can save a drawing");
    } else bad("a signed-in account can save a drawing", (await mine.text()).slice(0, 200));

    /*
      Every field of the shape has to survive the round trip. A column
      that dropped a key or coerced a number to a string would not fail
      the insert — it would fail on the canvas, later, silently.

      Compared field by field rather than by stringifying both sides,
      because `jsonb` does NOT preserve key order: it stores keys sorted
      by length and then alphabetically, so `{t,c,w,x1…}` comes back as
      `{c,t,w,x1…}`. The first version of this check compared JSON text
      and reported a failure for a row that was completely intact —
      a checker inventing work, which is worse than no checker.
      (`json`, without the b, would keep the order and lose the
      indexing. Not worth the trade for a key order nothing reads.)
    */
    const back = await rest(`video_annotations?select=*&video_id=eq.${videoId}`, a.h);
    const rows = back.ok ? await back.json() : [];
    const got = rows[0]?.shapes?.[0];
    const same =
      rows.length === 1 &&
      got &&
      Object.keys(ARROW).length === Object.keys(got).length &&
      Object.entries(ARROW).every(([k, v]) => got[k] === v);
    if (same) ok("every field of the shape survives the round trip");
    else bad("every field of the shape survives the round trip", `got ${JSON.stringify(got)}`);

    if (rows[0] && typeof rows[0].shapes?.[0]?.x1 === "number") {
      ok("coordinates come back as numbers", "the canvas can multiply them");
    } else if (rows[0]) {
      bad("coordinates come back as numbers", `x1 is ${typeof rows[0].shapes?.[0]?.x1}`);
    }

    // B must not see it.
    const theirs = await rest(`video_annotations?select=id&video_id=eq.${videoId}`, b.h);
    const seen = theirs.ok ? await theirs.json() : null;
    if (seen && seen.length === 0) ok("another account sees none of it", "owner-only holds");
    else bad("another account sees none of it", seen ? `it saw ${seen.length} row(s)` : `HTTP ${theirs.status}`);

    // Nor delete it. Reading and writing are separate permissions, and
    // RLS grants them separately — so they are checked separately.
    if (annId) {
      await rest(`video_annotations?id=eq.${annId}`, b.h, { method: "DELETE" });
      const still = await rest(`video_annotations?select=id&id=eq.${annId}`, svc);
      const left = still.ok ? await still.json() : [];
      left.length === 1
        ? ok("another account cannot delete it")
        : bad("another account cannot delete it", "the row is gone");
    }

    // Nor forge one onto A's account.
    const forged = await rest("video_annotations", b.h, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ user_id: a.id, video_id: videoId, at_seconds: 1, shapes: [ARROW] }),
    });
    if (forged.ok) {
      const row = await forged.json();
      bad("one account cannot draw on another's behalf", "the insert was accepted");
      if (row[0]?.id) await rest(`video_annotations?id=eq.${row[0].id}`, svc, { method: "DELETE" });
    } else ok("one account cannot draw on another's behalf", `HTTP ${forged.status}`);

    // ── the empty-drawing constraint ──
    const empty = await rest("video_annotations", a.h, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ video_id: videoId, at_seconds: 5, shapes: [] }),
    });
    if (empty.ok) {
      const row = await empty.json();
      bad("an empty drawing is refused", "it was accepted");
      if (row[0]?.id) await rest(`video_annotations?id=eq.${row[0].id}`, svc, { method: "DELETE" });
    } else ok("an empty drawing is refused", "video_annotations_not_empty");

    // ── negative time ──
    const negative = await rest("video_annotations", a.h, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ video_id: videoId, at_seconds: -3, shapes: [ARROW] }),
    });
    if (negative.ok) {
      const row = await negative.json();
      bad("a negative timestamp is refused", "it was accepted");
      if (row[0]?.id) await rest(`video_annotations?id=eq.${row[0].id}`, svc, { method: "DELETE" });
    } else ok("a negative timestamp is refused", `HTTP ${negative.status}`);

    // ── the cascade ──
    await rest(`videos?id=eq.${videoId}`, svc, { method: "DELETE" });
    const orphans = await rest(`video_annotations?select=id&video_id=eq.${videoId}`, svc);
    const remaining = orphans.ok ? await orphans.json() : null;
    if (remaining && remaining.length === 0) {
      ok("deleting the video takes its drawings with it");
      videoId = null;
    } else {
      bad(
        "deleting the video takes its drawings with it",
        remaining ? `${remaining.length} orphan(s) left behind` : `HTTP ${orphans.status}`,
      );
    }
  } catch (e) {
    bad("account probe", String(e.message ?? e).slice(0, 200));
  } finally {
    if (videoId) await rest(`videos?id=eq.${videoId}`, svc, { method: "DELETE" });
    for (const id of made) {
      await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
    }
    // Re-list rather than trusting the delete's own response.
    const left = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc });
    const all = left.ok ? ((await left.json()).users ?? []) : [];
    const stragglers = all.filter((u) => String(u.email ?? "").startsWith("midoxi-ann-"));
    stragglers.length === 0
      ? ok("probe accounts removed")
      : bad("probe accounts removed", `${stragglers.length} left: ${stragglers.map((u) => u.email).join(", ")}`);
  }
}

console.log(
  failures.length === 0
    ? `\n${pass} checks passed.\n`
    : `\n${pass} passed, ${failures.length} FAILED:\n${failures.map((f) => `  · ${f}`).join("\n")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
