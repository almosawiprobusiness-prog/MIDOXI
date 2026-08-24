#!/usr/bin/env node
/*
  Verify 0028 — user_preferences grants — and, if RESEND_API_KEY and
  EMAIL_FROM are both set, send one real test email through Resend to
  prove the account can actually send, not merely that the code compiles.

  THE LIVE SEND IS SAFE TO RUN. It goes to Resend's own dedicated test
  recipient, delivered@resend.dev — a real address Resend controls
  specifically for this, whose only behaviour is confirming receipt. It
  is not a real person's inbox, and running this script never emails
  anybody who did not ask for it.

  Without both env vars, this only checks the database grants and says
  plainly that the live send was skipped — same honesty as the rest of
  this project's verify scripts: unconfigured is a state to report, not
  a reason to fail quietly.

  Usage: node scripts/verify-email.mjs
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
  RESEND_API_KEY: resendKey,
  EMAIL_FROM: emailFrom,
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

console.log("\nuser_preferences grants\n");
{
  const res = await rest("user_preferences?select=user_id,email_opt_in,notif_prefs&limit=0", svc);
  res.ok ? ok("readable with the columns notify() needs") : bad("user_preferences", (await res.text()).slice(0, 200));
}

const anon = { apikey: anonKey, authorization: `Bearer ${anonKey}` };
{
  const r = await rest("user_preferences?select=*&limit=1", anon);
  if (r.ok) bad("anon reads user_preferences", `HTTP 200, ${(await r.json()).length} row(s)`);
  else ok("anon refused on user_preferences", `HTTP ${r.status}`);
}

console.log("\nas a real signed-in account\n");

const made = [];
try {
  const email = "midoxi-email-a@example.invalid";
  const password = "email-a-Qv93!ztr";
  const cr = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { ...svc, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = await cr.json();
  made.push(user.id);

  const tk = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { access_token } = await tk.json();
  const h = { apikey: anonKey, authorization: `Bearer ${access_token}` };

  // The signup trigger should have created this row already.
  {
    const r = await rest(`user_preferences?select=email_opt_in&user_id=eq.${user.id}`, h);
    const rows = r.ok ? await r.json() : [];
    rows.length === 1 && rows[0].email_opt_in === true
      ? ok("a fresh account starts opted in", "matches the column default")
      : bad("a fresh account starts opted in", `saw ${JSON.stringify(rows)}`);
  }

  // They can flip it, the way updateEmailOptIn does.
  {
    const r = await rest(`user_preferences?user_id=eq.${user.id}`, h, {
      method: "PATCH",
      headers: { "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ email_opt_in: false }),
    });
    const rows = r.ok ? await r.json() : [];
    rows[0]?.email_opt_in === false ? ok("they can turn email off") : bad("they can turn email off", (await r.text()).slice(0, 160));
  }
} catch (e) {
  bad("account probe", String(e.message ?? e).slice(0, 240));
} finally {
  for (const id of made) await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
}

console.log("\nsending\n");

if (!resendKey || !emailFrom) {
  console.log("  skip     RESEND_API_KEY and/or EMAIL_FROM are not set — live send not attempted.");
  console.log("           This is what hasEmail=false means: the app will not offer email either.");
} else {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: emailFrom,
      to: ["delivered@resend.dev"],
      subject: "MIDO XI — verify-email.mjs",
      html: "<p>If you can see this in the Resend dashboard, sending works.</p>",
      text: "If you can see this in the Resend dashboard, sending works.",
    }),
  });
  if (res.ok) {
    const data = await res.json();
    ok("a real email was accepted by Resend", `id ${data.id}`);
  } else {
    bad("sending through Resend", `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

console.log(
  failures.length === 0
    ? `\n${pass} checks passed.\n`
    : `\n${pass} passed, ${failures.length} FAILED:\n${failures.map((f) => `  · ${f}`).join("\n")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
