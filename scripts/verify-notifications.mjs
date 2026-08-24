#!/usr/bin/env node
/*
  Verify 0027 — notifications, made real — from the outside.

  The claim worth proving is the one the migration exists to close: a
  signed-in account must not be able to write a notification into
  somebody ELSE's inbox. `notifications` has held an owner-only `for all`
  policy since 0001, which is fine for writing your own — the danger is
  the INSERT privilege, which Supabase grants to `authenticated` by
  default on every public-schema table unless a migration explicitly
  takes it back. A missing revoke here would let any signed-in account
  plant a fake "your coach accepted" notification in anybody's inbox.

  Then the ordinary shape: anon refused everywhere, the owner can read
  and mark their own read, and a bystander cannot read somebody else's.

  Usage: node scripts/verify-notifications.mjs
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

console.log("\nwhat 0027 adds\n");
{
  const res = await rest(
    "notifications?select=id,user_id,actor_id,kind,title,body,href,read,meta,created_at&limit=0",
    svc,
  );
  res.ok ? ok("notifications", "(actor_id, meta, kind check)") : bad("notifications", (await res.text()).slice(0, 200));
}
{
  // The check constraint should refuse a kind this product never emits.
  const anyUser = await rest("profiles?select=id&limit=1", svc);
  const uid = anyUser.ok ? (await anyUser.json())[0]?.id : null;
  if (uid) {
    const r = await rest("notifications", svc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: uid, kind: "not_a_real_kind", title: "probe" }),
    });
    r.ok ? bad("the kind check constraint holds", "an unrecognised kind was accepted") : ok("the kind check constraint holds", `HTTP ${r.status}`);
  } else {
    bad("the kind check constraint holds", "no account to test with");
  }
}

console.log("\nthe anon key must be refused\n");
const anon = { apikey: anonKey, authorization: `Bearer ${anonKey}` };
{
  const r = await rest("notifications?select=*&limit=1", anon);
  if (r.ok) bad("anon reads notifications", `HTTP 200, ${(await r.json()).length} row(s)`);
  else ok("anon refused on notifications", `HTTP ${r.status}`);
}

console.log("\nas real accounts\n");

const made = [];
try {
  const mkUser = async (tag) => {
    const email = `midoxi-notif-${tag}@example.invalid`;
    const password = `notif-${tag}-Qv93!ztr`;
    const cr = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { ...svc, "content-type": "application/json" },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!cr.ok) throw new Error(`${tag}: ${(await cr.text()).slice(0, 200)}`);
    const user = await cr.json();
    made.push(user.id);
    const tk = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const { access_token } = await tk.json();
    return { id: user.id, h: { apikey: anonKey, authorization: `Bearer ${access_token}` } };
  };

  const [a, b] = [await mkUser("a"), await mkUser("b")];

  /*
    THE ONE THAT MATTERS. A can only write into A's own inbox — that is
    what the 0001 policy allows and is harmless. What must be refused is
    A writing into B's inbox, which is exactly what a forged "your coach
    accepted" notification would require.
  */
  {
    const r = await rest("notifications", a.h, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: b.id, kind: "follow", title: "forged notification" }),
    });
    r.ok
      ? bad("a signed-in account CANNOT write into another inbox", "the insert was accepted — a forged notification would work")
      : ok("a signed-in account CANNOT write into another inbox", `HTTP ${r.status}`);
  }

  // The server, via notify(), can — this is the real write path.
  const seeded = await rest("notifications", svc, {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "return=representation" },
    body: JSON.stringify({ user_id: b.id, actor_id: a.id, kind: "follow", title: "verify-notifications probe" }),
  });
  const notifId = seeded.ok ? (await seeded.json())[0]?.id : null;
  notifId ? ok("the server can write into the recipient's inbox") : bad("the server can write into the recipient's inbox", (await seeded.text()).slice(0, 200));

  if (notifId) {
    const r = await rest(`notifications?select=id,title&id=eq.${notifId}`, b.h);
    const rows = r.ok ? await r.json() : [];
    rows.length === 1 ? ok("the recipient can read it") : bad("the recipient can read it", `saw ${rows.length}`);
  }
  {
    const r = await rest(`notifications?select=id&id=eq.${notifId}`, a.h);
    const rows = r.ok ? await r.json() : null;
    rows && rows.length === 0
      ? ok("a bystander cannot read someone else's")
      : bad("a bystander cannot read someone else's", rows ? `saw ${rows.length}` : `HTTP ${r.status}`);
  }
  if (notifId) {
    const r = await rest(`notifications?id=eq.${notifId}`, b.h, {
      method: "PATCH",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ read: true }),
    });
    const rows = r.ok ? await r.json() : [];
    rows[0]?.read === true ? ok("the recipient can mark it read") : bad("the recipient can mark it read", (await r.text()).slice(0, 160));
  }
  if (notifId) {
    const r = await rest(`notifications?id=eq.${notifId}`, a.h, {
      method: "PATCH",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ read: false }),
    });
    const rows = r.ok ? await r.json() : [];
    rows.length === 0 ? ok("a bystander cannot mark someone else's read") : bad("a bystander cannot mark someone else's read", "the update landed");
  }
} catch (e) {
  bad("account probe", String(e.message ?? e).slice(0, 240));
} finally {
  for (const id of made) await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
  const left = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc });
  const strays = (left.ok ? ((await left.json()).users ?? []) : []).filter((u) => String(u.email ?? "").startsWith("midoxi-notif-"));
  strays.length === 0 ? ok("probe accounts removed") : bad("probe accounts removed", `${strays.length} left`);
}

console.log(
  failures.length === 0
    ? `\n${pass} checks passed. Only the server can write a notification, and only the recipient can read one.\n`
    : `\n${pass} passed, ${failures.length} FAILED:\n${failures.map((f) => `  · ${f}`).join("\n")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
