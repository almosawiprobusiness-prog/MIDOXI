#!/usr/bin/env node
/*
  Verify 0026 — measured recovery — from the outside.

  One claim here matters more than all the others: a signed-in account
  must not be able to read `provider_tokens`. A WHOOP refresh token is a
  long-lived key to somebody's physiological history, and RLS cannot
  protect it on its own — RLS filters ROWS, not columns, so a policy that
  says "your own row" still hands you your own refresh token. The only
  reliable defence is for `authenticated` to hold no privilege on the
  table at all, and that is a property of the database rather than of the
  migration file.

  The rest: readings are read-only to their owner (a player who could
  write their own physiology makes a coach's reading of it worthless),
  and anon is refused everywhere.

  Usage: node scripts/verify-wearables.mjs
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

console.log("\nwhat 0026 adds\n");
for (const [table, columns] of [
  ["provider_connections", "id, user_id, provider, status, external_user_id, scopes, connected_at, last_sync_at, last_error"],
  ["provider_tokens", "connection_id, access_token, refresh_token, expires_at, updated_at"],
  ["recovery_samples", "id, user_id, source, day, recorded_at, recovery_score, hrv_ms, resting_hr, spo2_percent, skin_temp_c, sleep_performance, sleep_duration_min, sleep_need_min, sleep_efficiency, strain, external_id, raw"],
]) {
  const res = await rest(`${table}?select=${encodeURIComponent(columns)}&limit=0`, svc);
  if (res.ok) ok(table, `(${columns.split(",").length} columns)`);
  else bad(table, (await res.text()).slice(0, 200));
}

console.log("\nthe anon key must be refused\n");
const anon = { apikey: anonKey, authorization: `Bearer ${anonKey}` };
for (const t of ["provider_connections", "provider_tokens", "recovery_samples"]) {
  const res = await rest(`${t}?select=*&limit=1`, anon);
  if (res.ok) bad(`anon reads ${t}`, `HTTP 200, ${(await res.json()).length} row(s)`);
  else ok(`anon refused on ${t}`, `HTTP ${res.status}`);
}

console.log("\nas a real signed-in account\n");

const made = [];
try {
  const email = "midoxi-wear-a@example.invalid";
  const password = "wear-a-Qv93!ztr";
  const cr = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...svc, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!cr.ok) throw new Error((await cr.text()).slice(0, 200));
  const user = await cr.json();
  made.push(user.id);

  const tk = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { access_token } = await tk.json();
  const h = { apikey: anonKey, authorization: `Bearer ${access_token}` };

  // Seed a connection + token as the service role, the way the callback does.
  const conn = await rest("provider_connections", svc, {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({ user_id: user.id, provider: "whoop", status: "active", scopes: "offline read:recovery" }),
  });
  if (!conn.ok) throw new Error(`seed connection: ${(await conn.text()).slice(0, 200)}`);
  const connectionId = (await conn.json())[0].id;

  const SECRET = "refresh-token-that-must-never-reach-a-browser";
  const tok = await rest("provider_tokens", svc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ connection_id: connectionId, access_token: "at", refresh_token: SECRET }),
  });
  tok.ok ? ok("the server can store a token") : bad("the server can store a token", (await tok.text()).slice(0, 200));

  // -- the one that matters ------------------------------------
  {
    const r = await rest("provider_tokens?select=refresh_token", h);
    if (r.status === 401 || r.status === 403) {
      ok("the owner CANNOT read their own refresh token", `refused at the privilege — HTTP ${r.status}`);
    } else if (r.ok) {
      const rows = await r.json();
      const leaked = JSON.stringify(rows).includes(SECRET);
      if (leaked) bad("the owner CANNOT read their own refresh token", "THE TOKEN WAS RETURNED TO A BROWSER-CAPABLE ROLE");
      else bad("the owner CANNOT read their own refresh token", `HTTP 200 with ${rows.length} row(s) — RLS is hiding it, but authenticated HOLDS select. Grant, not policy.`);
    } else {
      bad("the owner CANNOT read their own refresh token", `unexpected HTTP ${r.status}`);
    }
  }

  // -- connections are visible, credentials are not ------------
  {
    const r = await rest("provider_connections?select=provider,status,last_sync_at", h);
    const rows = r.ok ? await r.json() : [];
    rows.length === 1 && rows[0].provider === "whoop"
      ? ok("the owner CAN see that they are connected")
      : bad("the owner CAN see that they are connected", `HTTP ${r.status}, ${rows.length} row(s)`);
  }

  // -- readings are read-only ----------------------------------
  {
    const r = await rest("recovery_samples", svc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: user.id, source: "whoop", day: "2026-08-20", recorded_at: new Date().toISOString(), recovery_score: 61, hrv_ms: 74.2, resting_hr: 48 }),
    });
    r.ok ? ok("the server can write a reading") : bad("the server can write a reading", (await r.text()).slice(0, 200));
  }
  {
    const r = await rest("recovery_samples?select=day,recovery_score,hrv_ms", h);
    const rows = r.ok ? await r.json() : [];
    rows.length === 1 ? ok("the owner can read their readings") : bad("the owner can read their readings", `saw ${rows.length}`);
  }
  {
    // A player who can invent their own HRV makes a coach's reading of it worthless.
    const r = await rest("recovery_samples", h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: user.id, source: "whoop", day: "2026-08-21", recorded_at: new Date().toISOString(), recovery_score: 99 }),
    });
    r.ok ? bad("a player cannot write their own physiology", "the insert was accepted") : ok("a player cannot write their own physiology", `HTTP ${r.status}`);
  }
  {
    const r = await rest("recovery_samples?day=eq.2026-08-20", h, {
      method: "PATCH",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ recovery_score: 99 }),
    });
    if (r.status === 401 || r.status === 403) ok("a player cannot edit a reading", `HTTP ${r.status}`);
    else if (r.ok && (await r.json()).length === 0) bad("a player cannot edit a reading", "HTTP 200 — RLS blocked it but the privilege is held");
    else bad("a player cannot edit a reading", "an UPDATE succeeded");
  }
  {
    // Deleting IS allowed: it is their data to remove.
    const r = await rest("recovery_samples?day=eq.2026-08-20", h, {
      method: "DELETE",
      headers: { prefer: "return=representation" },
    });
    const rows = r.ok ? await r.json() : [];
    rows.length === 1 ? ok("but they can delete it — it is theirs") : bad("but they can delete it — it is theirs", `HTTP ${r.status}`);
  }
} catch (e) {
  bad("account probe", String(e.message ?? e).slice(0, 240));
} finally {
  for (const id of made) await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
  const left = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc });
  const strays = (left.ok ? ((await left.json()).users ?? []) : []).filter((u) => String(u.email ?? "").startsWith("midoxi-wear-"));
  strays.length === 0 ? ok("probe account removed") : bad("probe account removed", `${strays.length} left`);

  const t = await fetch(`${url}/rest/v1/provider_tokens?select=connection_id`, { headers: svc });
  const rows = t.ok ? await t.json() : [];
  rows.length === 0 ? ok("its token cascaded away with it") : bad("its token cascaded away with it", `${rows.length} row(s) remain`);
}

console.log(
  failures.length === 0
    ? `\n${pass} checks passed. Readings are readable, credentials are not, and nobody can write their own physiology.\n`
    : `\n${pass} passed, ${failures.length} FAILED:\n${failures.map((f) => `  · ${f}`).join("\n")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
