#!/usr/bin/env node
/*
  Connect e2e — probe trainer setup / teardown.

  Creates ONE obviously-synthetic trainer account for the test-mode
  Stripe Connect run: profiles.role = trainer, a practice name, and
  four ACTIVE athletes so the fee tier reads 2% (the 6th athlete would
  drop it — four keeps the top tier under test). Everything is created
  with the service role and torn down by `--teardown`, which deletes
  the auth user (every owned row cascades) and RE-LISTS to prove it.

  Usage: node scripts/connect-e2e-setup.mjs [--teardown]
  Prints the probe's credentials (synthetic, test-only) on setup.
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
const H = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

const EMAIL = "midoxi.connect.e2e.probe@example.com";
const PASSWORD = "probe-Connect-E2E-2026!";

async function admin(method, path, body) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { ...H, Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function findProbe() {
  const r = await admin("GET", `/auth/v1/admin/users?page=1&per_page=200`);
  const users = r.json?.users ?? r.json ?? [];
  return (Array.isArray(users) ? users : []).find((u) => u.email === EMAIL) ?? null;
}

if (process.argv.includes("--teardown")) {
  const probe = await findProbe();
  if (!probe) {
    console.log("teardown: no probe user found — nothing to remove");
    process.exit(0);
  }
  const del = await admin("DELETE", `/auth/v1/admin/users/${probe.id}`);
  const still = await findProbe();
  console.log(`teardown: delete status ${del.status}; re-listed: ${still ? "STILL PRESENT (FAIL)" : "gone"}`);
  process.exit(still ? 1 : 0);
}

// ---- setup ----
let user = await findProbe();
if (!user) {
  const r = await admin("POST", "/auth/v1/admin/users", {
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { probe: "midoxi-connect-e2e" },
  });
  user = r.json;
  if (!user?.id) {
    console.error("could not create probe user:", r.status, r.text.slice(0, 200));
    process.exit(1);
  }
  console.log("probe user created:", user.id);
} else {
  console.log("probe user exists:", user.id);
}

// The profile row (a trigger may have made it; upsert either way).
await admin("POST", "/rest/v1/profiles?on_conflict=id", [{
  id: user.id,
  full_name: "Probe Trainer",
  known_as: "Probe",
  role: "trainer",
  onboarding_complete: true,
}]).then((r) => console.log("profile:", r.status));

await admin("POST", "/rest/v1/trainer_profiles?on_conflict=user_id", [{
  user_id: user.id,
  practice: "Northgate Performance (E2E)",
  specialism: "Speed & power",
}]).then((r) => console.log("trainer_profile:", r.status));

// Four ACTIVE athletes → the 2% tier is what the payment link must freeze.
const { json: existing } = await admin(
  "GET",
  `/rest/v1/trainer_athletes?trainer_id=eq.${user.id}&select=id`,
);
if ((existing ?? []).length === 0) {
  const athletes = ["Probe Athlete A", "Probe Athlete B", "Probe Athlete C", "Probe Athlete D"].map(
    (name) => ({ trainer_id: user.id, display_name: name, position: "CF", status: "active" }),
  );
  const r = await admin("POST", "/rest/v1/trainer_athletes", athletes);
  console.log("athletes:", r.status, (r.json ?? []).length ?? "");
} else {
  console.log("athletes: already present,", existing.length);
}

console.log("\nprobe ready:");
console.log("  email:   ", EMAIL);
console.log("  password:", PASSWORD);
console.log("  expected fee tier: 2% (4 active athletes)");
