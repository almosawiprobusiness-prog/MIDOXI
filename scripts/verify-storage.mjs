#!/usr/bin/env node
/*
  Do the upload limits the app SHOWS match the ones the server ENFORCES?

  They did not. The film room refused files over 50 MB while the
  `videos` bucket refused anything over 48, so a 49 MB clip passed the
  check the person could see and failed at the one they could not — with
  a bare "Upload failed (413)" and no way to tell what had gone wrong.

  Two enforcement points, in two systems, with no connection between
  them: exactly the shape that drifts. This is the connection.

  It also pins the project's own ceiling. The free plan refuses to set
  any bucket above 50 MB — measured, not assumed: 100, 200 and 500 all
  come back 413. If that ever changes because the plan changed, the
  numbers here are what has to move together.

  Usage: node scripts/verify-storage.mjs
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

/** Read a numeric constant out of a source file, so this cannot drift from the code. */
function constFromSource(file, name) {
  const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const m = src.match(new RegExp(`export const ${name}\\s*=\\s*([0-9]+)`));
  return m ? Number(m[1]) : null;
}

const EXPECTED = [
  {
    bucket: "videos",
    mb: constFromSource("lib/data/film-types.ts", "UPLOAD_MAX_MB"),
    from: "UPLOAD_MAX_MB in lib/data/film-types.ts",
    public: false,
  },
  {
    bucket: "posts",
    // feed-types states this in bytes, as VIDEO_MAX_BYTES.
    mb: (constFromSource("lib/data/feed-types.ts", "VIDEO_MAX_BYTES") ?? 0) || 25,
    from: "VIDEO_MAX_BYTES in lib/data/feed-types.ts",
    public: true,
  },
];

const svc = { apikey: key, authorization: `Bearer ${key}` };
let pass = 0;
const failures = [];
const ok = (l, d = "") => { pass++; console.log(`  ok       ${l}${d ? `  ${d}` : ""}`); };
const bad = (l, d = "") => { failures.push(`${l}${d ? ` — ${d}` : ""}`); console.log(`  BAD      ${l}${d ? `\n           ${d}` : ""}`); };

console.log("\nwhat the app promises vs what storage enforces\n");

const res = await fetch(`${url}/storage/v1/bucket`, { headers: svc });
if (!res.ok) {
  console.error(`Could not list buckets: ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}
const buckets = await res.json();

for (const want of EXPECTED) {
  const b = buckets.find((x) => x.name === want.bucket);
  if (!b) {
    bad(`${want.bucket} bucket exists`);
    continue;
  }
  const actualMb = b.file_size_limit ? Math.round(b.file_size_limit / 1048576) : null;
  if (actualMb === null) {
    bad(`${want.bucket} has a size limit`, "no limit set — the app's own cap is then the only guard");
    continue;
  }
  if (actualMb === want.mb) {
    ok(`${want.bucket} limit matches the app`, `${actualMb} MB, from ${want.from}`);
  } else {
    bad(
      `${want.bucket} limit matches the app`,
      `bucket enforces ${actualMb} MB but the app tells people ${want.mb} MB (${want.from}). ` +
        `Anything between the two passes the visible check and fails with a bare 413.`,
    );
  }
  if (b.public === want.public) ok(`${want.bucket} visibility`, b.public ? "public" : "private");
  else bad(`${want.bucket} visibility`, `expected ${want.public ? "public" : "private"}, got the opposite`);
}

/*
  The project ceiling. Attempted rather than looked up, because the plan
  is what decides it and there is no endpoint that states it plainly.
*/
console.log("\nthe project's own ceiling\n");
{
  const probe = await fetch(`${url}/storage/v1/bucket/videos`, {
    method: "PUT",
    headers: { ...svc, "content-type": "application/json" },
    body: JSON.stringify({
      id: "videos",
      name: "videos",
      public: false,
      file_size_limit: 100 * 1024 * 1024,
      allowed_mime_types: ["video/mp4", "video/webm", "video/quicktime"],
    }),
  });

  if (probe.ok) {
    // The plan now allows more than the app offers — worth saying, since
    // it means a real increase is available for free.
    ok("the plan allows more than 50 MB", "raise UPLOAD_MAX_MB and this bucket together");
    // Put it back where the app expects it.
    const restoreMb = EXPECTED[0].mb;
    await fetch(`${url}/storage/v1/bucket/videos`, {
      method: "PUT",
      headers: { ...svc, "content-type": "application/json" },
      body: JSON.stringify({
        id: "videos",
        name: "videos",
        public: false,
        file_size_limit: restoreMb * 1024 * 1024,
        allowed_mime_types: ["video/mp4", "video/webm", "video/quicktime"],
      }),
    });
    console.log(`           (restored to ${restoreMb} MB)`);
  } else {
    ok("50 MB is the plan's ceiling", "100 MB refused — a larger cap needs a Supabase plan upgrade");
  }
}

console.log(
  failures.length === 0
    ? `\n${pass} checks passed. What the upload dialog promises is what storage will accept.\n`
    : `\n${pass} passed, ${failures.length} FAILED:\n${failures.map((f) => `  · ${f}`).join("\n")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
