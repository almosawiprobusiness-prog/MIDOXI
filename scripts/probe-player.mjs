#!/usr/bin/env node
/*
  Create (or remove) two throwaway player accounts to test the feed as a real
  signed-in user rather than in demo mode.

  Demo mode is why the community section shipped on top of three tables that
  did not exist: it serves an in-memory store and never touches Postgres, so
  every route rendered green over an empty schema. Anything that matters has to
  be exercised against the real backend by an account that owns nothing special.

  Two accounts, not one, because half of what the feed does is relational —
  following, follower counts, and a block that has to hold in both directions.
  One account cannot test any of it.

  Deliberately obvious: @example.invalid is a reserved TLD that can never
  receive mail, and the handles are prefixed so they are recognisable in the
  database at a glance.

    node scripts/probe-player.mjs           create, print the credentials
    node scripts/probe-player.mjs --clean   delete them and everything they own
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
const json = { ...svc, "content-type": "application/json" };
const CLEAN = process.argv.includes("--clean");

const PEOPLE = [
  {
    tag: "one",
    email: "midoxi-probe-one@example.invalid",
    password: "probe-one-Ktm93!vqz",
    name: "Probe One",
    handle: "probe_one",
    // Must be one of the values the onboarding form offers — the app's
    // vocabulary is positional numbers, so there is no "CM". Seeding a value
    // the UI cannot represent makes the profile render something no player
    // could have chosen.
    position: "8",
    club: "Probe FC",
    bio: "Throwaway account for testing the feed. Safe to delete.",
  },
  {
    tag: "two",
    email: "midoxi-probe-two@example.invalid",
    password: "probe-two-Ktm93!vqz",
    name: "Probe Two",
    handle: "probe_two",
    position: "RB",
    club: "Probe FC",
    bio: "The second half of every relational test. Safe to delete.",
  },
];

/** Every probe account currently in auth, by email prefix. */
async function existing() {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc });
  if (!res.ok) throw new Error(`list users: ${(await res.text()).slice(0, 200)}`);
  const users = (await res.json()).users ?? [];
  return users.filter((u) => String(u.email ?? "").startsWith("midoxi-probe-"));
}

if (CLEAN) {
  const found = await existing();
  for (const u of found) {
    await fetch(`${url}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: svc });
    console.log(`  deleted  ${u.email}`);
  }
  // Re-list rather than trust the delete's own response — posts, follows and
  // profiles all cascade off auth.users, so this is the only thing that needs
  // checking, but it does need checking.
  const left = await existing();
  console.log(
    left.length === 0
      ? `\n${found.length} probe account(s) removed, confirmed by re-listing.\n`
      : `\nSTILL PRESENT: ${left.map((u) => u.email).join(", ")}\n`,
  );
  process.exit(left.length === 0 ? 0 : 1);
}

const already = await existing();
const out = [];

for (const p of PEOPLE) {
  let user = already.find((u) => u.email === p.email);

  if (!user) {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        email: p.email,
        password: p.password,
        // No inbox exists for a .invalid address, so the confirmation email
        // could never be clicked.
        email_confirm: true,
        user_metadata: { full_name: p.name, role: "player" },
      }),
    });
    if (!res.ok) {
      console.error(`${p.email}: ${(await res.text()).slice(0, 300)}`);
      process.exit(1);
    }
    user = await res.json();
    console.log(`  created  ${p.email}`);
  } else {
    console.log(`  exists   ${p.email}`);
  }

  /*
    `profiles` is created by a trigger on auth.users (0001), so it is upserted
    rather than inserted — the row is already there.
  */
  await fetch(`${url}/rest/v1/profiles?on_conflict=id`, {
    method: "POST",
    headers: { ...json, prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: user.id, full_name: p.name, known_as: p.name.split(" ")[0], role: "player" }),
  });

  // The handle is what /app/community/[handle] resolves, so the profile is not
  // optional for this test.
  const prof = await fetch(`${url}/rest/v1/player_profiles?on_conflict=user_id`, {
    method: "POST",
    headers: { ...json, prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      handle: p.handle,
      primary_position: p.position,
      club: p.club,
      bio: p.bio,
      is_public: true,
    }),
  });
  if (!prof.ok) console.error(`  profile  FAILED: ${(await prof.text()).slice(0, 200)}`);

  out.push({ ...p, id: user.id });
}

console.log("\nSigned-in test accounts:\n");
for (const p of out) {
  console.log(`  ${p.name.padEnd(10)} ${p.email}`);
  console.log(`  ${" ".repeat(10)} ${p.password}   @${p.handle}   ${p.id}`);
}
console.log("\nDelete them with:  node scripts/probe-player.mjs --clean\n");
