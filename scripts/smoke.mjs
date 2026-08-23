#!/usr/bin/env node
/*
  Smoke test — verifies a running MIDO XI (dev or a deploy) serves its core
  routes and that auth-gating + the health probe behave. No credentials needed.

  Usage:  node scripts/smoke.mjs [baseUrl]
          BASE_URL=https://mido-xi.vercel.app node scripts/smoke.mjs
*/

const base = (process.argv[2] || process.env.BASE_URL || "http://localhost:3100").replace(/\/$/, "");
let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function status(path, { method = "GET" } = {}) {
  const res = await fetch(base + path, { method, redirect: "manual" });
  return res;
}

console.log(`\nSmoke test → ${base}\n`);

await check("landing / returns 200", async () => {
  const r = await status("/");
  assert(r.status === 200, `expected 200, got ${r.status}`);
});

await check("login page returns 200", async () => {
  const r = await status("/login");
  assert(r.status === 200, `expected 200, got ${r.status}`);
});

await check("/app is auth-gated (redirect or 200 in demo)", async () => {
  const r = await status("/app");
  assert([200, 302, 307].includes(r.status), `expected redirect/200, got ${r.status}`);
});

await check("/app/membership is auth-gated", async () => {
  const r = await status("/app/membership");
  assert([200, 302, 307].includes(r.status), `expected redirect/200, got ${r.status}`);
});

await check("health endpoint responds with JSON", async () => {
  const r = await fetch(base + "/api/health");
  assert([200, 503].includes(r.status), `expected 200/503, got ${r.status}`);
  const j = await r.json();
  assert(typeof j.status === "string", "missing status field");
  assert(j.features && typeof j.features === "object", "missing features");
  console.log(`      mode=${j.mode} db=${j.db} ai=${j.features.ai} youtube=${j.features.youtube} billing=${j.features.billing}`);
});

await check("stripe webhook rejects unsigned POST", async () => {
  const r = await fetch(base + "/api/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  // 503 when billing unconfigured, 400 when configured but signature missing.
  assert([400, 503].includes(r.status), `expected 400/503, got ${r.status}`);
});

await check("unknown route returns 404", async () => {
  const r = await status("/definitely-not-a-real-page-xyz");
  assert(r.status === 404, `expected 404, got ${r.status}`);
});

console.log(`\n${failures === 0 ? "✓ all checks passed" : `✗ ${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
