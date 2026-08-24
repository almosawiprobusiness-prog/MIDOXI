#!/usr/bin/env node
/*
  Verify 0024 — meetings two people share — from the outside.

  The whole feature rests on claims that are invisible from inside the
  app, and each one fails silently if it is wrong:

    · A meeting is readable by BOTH parties and by nobody else. If the
      second half is wrong, every meeting in the database is public to
      every signed-in account and nothing anywhere says so.

    · Either party may propose a new time, and neither may simply write
      one. If the update policy is too loose, "rescheduling is a
      proposal" is decoration and a coach can move a session onto a
      player's match day unannounced.

    · The history is append-only. That is enforced by the ABSENCE of an
      update and delete grant, which is precisely the kind of thing that
      is true in the migration file and false in the database.

    · One open proposal at a time, enforced by a partial unique index.

  Probed as two real signed-in accounts, because none of it can be
  checked as the service role — which bypasses RLS entirely and would
  report every one of these as passing.

  Usage: node scripts/verify-meetings.mjs
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
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and");
  console.error("SUPABASE_SERVICE_ROLE_KEY must all be set in .env.local.");
  process.exit(1);
}

const svc = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
let pass = 0;
const failures = [];
const ok = (l, d = "") => { pass++; console.log(`  ok       ${l}${d ? `  ${d}` : ""}`); };
const bad = (l, d = "") => { failures.push(`${l}${d ? ` — ${d}` : ""}`); console.log(`  BAD      ${l}${d ? `\n           ${d}` : ""}`); };

const rest = (path, headers, init = {}) =>
  fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });

// ── 1 · shape ────────────────────────────────────────────────
console.log("\nwhat 0024 adds\n");

for (const [table, columns] of [
  ["meetings", "id, created_by, with_user, kind, title, note, starts_at, ends_at, status, video_provider, video_room, external_url, created_at, updated_at"],
  ["meeting_proposals", "id, meeting_id, proposed_by, starts_at, ends_at, note, status, created_at"],
  ["meeting_agenda", "id, meeting_id, added_by, position, kind, title, body, ref_clip, ref_study, ref_video, ref_goal, at_seconds, done, created_at"],
  ["meeting_events", "id, meeting_id, actor_id, action, detail, created_at"],
]) {
  const res = await rest(`${table}?select=${encodeURIComponent(columns)}&limit=0`, svc);
  if (res.ok) ok(table, `(${columns.split(",").length} columns)`);
  else bad(table, (await res.text()).slice(0, 200));
}

// ── 2 · the grant ────────────────────────────────────────────
console.log("\nthe anon key must be refused by all four\n");

const anon = { apikey: anonKey, authorization: `Bearer ${anonKey}` };
for (const t of ["meetings", "meeting_proposals", "meeting_agenda", "meeting_events"]) {
  const res = await rest(`${t}?select=*&limit=1`, anon);
  if (res.ok) bad(`anon reads ${t}`, `HTTP 200, ${(await res.json()).length} row(s)`);
  else ok(`anon refused on ${t}`, `HTTP ${res.status}`);
}

// ── 3 · three accounts ───────────────────────────────────────
console.log("\nas real accounts\n");

const made = [];
const mkUser = async (tag) => {
  const email = `midoxi-meet-${tag}@example.invalid`;
  const password = `meet-${tag}-Qv93!ztr`;
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

let meetingId = null;

try {
  // A and B are the two parties. C is a bystander — the account that
  // proves "readable by both" does not quietly mean "readable by all".
  const [a, b, c] = [await mkUser("a"), await mkUser("b"), await mkUser("c")];

  const soon = new Date(Date.now() + 864e5).toISOString();
  const later = new Date(Date.now() + 864e5 + 45 * 60_000).toISOString();

  // -- create -------------------------------------------------
  const created = await rest("meetings", a.h, {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({
      created_by: a.id, with_user: b.id, kind: "film",
      title: "verify-meetings probe", starts_at: soon, ends_at: later,
    }),
  });
  if (!created.ok) throw new Error(`create: ${(await created.text()).slice(0, 200)}`);
  meetingId = (await created.json())[0].id;
  ok("a participant can create a meeting");

  // -- both read, nobody else ---------------------------------
  for (const [who, h] of [["organiser", a.h], ["invitee", b.h]]) {
    const r = await rest(`meetings?select=id&id=eq.${meetingId}`, h);
    const rows = r.ok ? await r.json() : [];
    rows.length === 1 ? ok(`the ${who} reads it`) : bad(`the ${who} reads it`, `saw ${rows.length}`);
  }
  {
    const r = await rest(`meetings?select=id&id=eq.${meetingId}`, c.h);
    const rows = r.ok ? await r.json() : null;
    rows && rows.length === 0
      ? ok("a bystander cannot", "RLS holds")
      : bad("a bystander cannot", rows ? `saw ${rows.length} row(s)` : `HTTP ${r.status}`);
  }

  // -- a bystander cannot write either -------------------------
  {
    const r = await rest(`meetings?id=eq.${meetingId}`, c.h, {
      method: "PATCH",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ title: "hijacked" }),
    });
    const rows = r.ok ? await r.json() : [];
    rows.length === 0 ? ok("a bystander cannot edit it") : bad("a bystander cannot edit it", "the update landed");
  }

  // -- nobody may invent a meeting in somebody else's name -----
  {
    const r = await rest("meetings", c.h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ created_by: a.id, with_user: b.id, kind: "call", title: "forged", starts_at: soon, ends_at: later }),
    });
    r.ok
      ? bad("a meeting cannot be created in another name", "it was accepted")
      : ok("a meeting cannot be created in another name", `HTTP ${r.status}`);
  }

  // -- the invitee accepts ------------------------------------
  {
    const r = await rest(`meetings?id=eq.${meetingId}`, b.h, {
      method: "PATCH",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    const rows = r.ok ? await r.json() : [];
    rows[0]?.status === "confirmed" ? ok("the invitee can accept") : bad("the invitee can accept", (await r.text()).slice(0, 160));
  }

  // -- proposals ----------------------------------------------
  const moved = new Date(Date.now() + 2 * 864e5).toISOString();
  const movedEnd = new Date(Date.now() + 2 * 864e5 + 45 * 60_000).toISOString();
  {
    // The player proposing to their coach is the case that matters.
    const r = await rest("meeting_proposals", b.h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meeting_id: meetingId, proposed_by: b.id, starts_at: moved, ends_at: movedEnd }),
    });
    r.ok ? ok("either side can propose a new time") : bad("either side can propose a new time", (await r.text()).slice(0, 200));
  }
  {
    // Two live offers is how both people end up at different times.
    const r = await rest("meeting_proposals", a.h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meeting_id: meetingId, proposed_by: a.id, starts_at: moved, ends_at: movedEnd }),
    });
    r.ok
      ? bad("only one open proposal at a time", "a second pending row was accepted")
      : ok("only one open proposal at a time", `HTTP ${r.status}`);
  }
  {
    const r = await rest(`meeting_proposals?select=id&meeting_id=eq.${meetingId}`, c.h);
    const rows = r.ok ? await r.json() : null;
    rows && rows.length === 0
      ? ok("a bystander cannot read proposals")
      : bad("a bystander cannot read proposals", rows ? `saw ${rows.length}` : `HTTP ${r.status}`);
  }

  // -- the shared agenda --------------------------------------
  let itemId = null;
  {
    const r = await rest("meeting_agenda", a.h, {
      method: "POST",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ meeting_id: meetingId, added_by: a.id, position: 1, kind: "note", title: "added by the coach" }),
    });
    if (r.ok) { itemId = (await r.json())[0].id; ok("an item can be added"); }
    else bad("an item can be added", (await r.text()).slice(0, 200));
  }
  if (itemId) {
    // The claim that makes it SHARED rather than two lists side by side.
    const r = await rest(`meeting_agenda?id=eq.${itemId}`, b.h, {
      method: "PATCH",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ done: true, position: 2.5 }),
    });
    const rows = r.ok ? await r.json() : [];
    rows[0]?.done === true
      ? ok("the other party can reorder and tick off an item they did not add")
      : bad("the other party can reorder and tick off an item they did not add", (await r.text()).slice(0, 160));
  }
  if (itemId) {
    // Deleting is held to the author.
    const r = await rest(`meeting_agenda?id=eq.${itemId}`, b.h, {
      method: "DELETE",
      headers: { prefer: "return=representation" },
    });
    const rows = r.ok ? await r.json() : [];
    rows.length === 0
      ? ok("only the author may delete their item")
      : bad("only the author may delete their item", "it was deleted by the other party");
  }

  // -- the history is append-only -----------------------------
  {
    const r = await rest("meeting_events", a.h, {
      method: "POST",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ meeting_id: meetingId, actor_id: a.id, action: "created" }),
    });
    r.ok ? ok("history can be written") : bad("history can be written", (await r.text()).slice(0, 200));
  }
  /*
    The two worth proving, and the reason this script earns its keep.

    The first version accepted "HTTP 200, no rows affected" as a pass. It
    is not one. 200 means the PRIVILEGE check succeeded and only RLS —
    which happens to have no update policy — stopped the write. 0024
    claimed the privilege was absent and had in fact never revoked
    anything from `authenticated`, which holds ALL by Supabase default,
    so the grant line it wrote added nothing.

    Nothing was ever rewritable in practice, but the guarantee rested on
    the continued absence of a policy rather than the absence of a
    privilege. So these now insist on 401/403: the floor has to be the
    privilege, or a future `for all` policy silently turns an audit log
    into an editable one. 0025 is what makes them pass.
  */
  {
    const r = await rest(`meeting_events?meeting_id=eq.${meetingId}`, a.h, {
      method: "PATCH",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ action: "cancelled" }),
    });
    if (r.status === 401 || r.status === 403) ok("history cannot be rewritten", `refused at the privilege — HTTP ${r.status}`);
    else if (r.ok && (await r.json()).length === 0)
      bad("history cannot be rewritten", "HTTP 200 — RLS blocked it, but authenticated still HOLDS update. Run 0025.");
    else bad("history cannot be rewritten", "an UPDATE succeeded");
  }
  {
    const r = await rest(`meeting_events?meeting_id=eq.${meetingId}`, a.h, {
      method: "DELETE",
      headers: { prefer: "return=representation" },
    });
    if (r.status === 401 || r.status === 403) ok("history cannot be erased", `refused at the privilege — HTTP ${r.status}`);
    else if (r.ok && (await r.json()).length === 0)
      bad("history cannot be erased", "HTTP 200 — RLS blocked it, but authenticated still HOLDS delete. Run 0025.");
    else bad("history cannot be erased", "a DELETE succeeded");
  }

  // -- the constraints ----------------------------------------
  {
    const r = await rest("meetings", a.h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ created_by: a.id, with_user: a.id, kind: "call", title: "with myself", starts_at: soon, ends_at: later }),
    });
    r.ok ? bad("a meeting with yourself is refused", "accepted") : ok("a meeting with yourself is refused", `HTTP ${r.status}`);
  }
  {
    const r = await rest("meetings", a.h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ created_by: a.id, with_user: b.id, kind: "call", title: "backwards", starts_at: later, ends_at: soon }),
    });
    r.ok ? bad("a backwards meeting is refused", "accepted") : ok("a backwards meeting is refused", `HTTP ${r.status}`);
  }
} catch (e) {
  bad("account probe", String(e.message ?? e).slice(0, 240));
} finally {
  for (const id of made) {
    await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
  }
  const left = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc });
  const all = left.ok ? ((await left.json()).users ?? []) : [];
  const strays = all.filter((u) => String(u.email ?? "").startsWith("midoxi-meet-"));
  strays.length === 0
    ? ok("probe accounts removed", "and the meeting cascaded with them")
    : bad("probe accounts removed", `${strays.length} left`);

  // The meeting hung off account A, so deleting A must have taken it.
  if (meetingId) {
    const r = await fetch(`${url}/rest/v1/meetings?select=id&id=eq.${meetingId}`, { headers: svc });
    const rows = r.ok ? await r.json() : [];
    rows.length === 0 ? ok("the probe meeting is gone") : bad("the probe meeting is gone", "it outlived its owner");
  }
}

console.log(
  failures.length === 0
    ? `\n${pass} checks passed. 0024 is live: both parties, neither alone, and a history nobody can rewrite.\n`
    : `\n${pass} passed, ${failures.length} FAILED:\n${failures.map((f) => `  · ${f}`).join("\n")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
