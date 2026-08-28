#!/usr/bin/env node
/*
  Verify the MIDO XI Capture extension API against a RUNNING server.

  Unlike the other verify scripts this does not touch the database
  directly — it speaks to /api/extension/* exactly the way the popup
  does, and proves the contract: session shape, capture validation,
  origin gating, idempotency, and that a saved moment actually surfaces
  in the Film Room.

  Run against demo mode for the full loop with no keys:
    npm run dev:demo          (in one terminal)
    node scripts/verify-extension-api.mjs   (in another)

  Usage: node scripts/verify-extension-api.mjs [base-url]
*/

const base = process.argv[2] ?? "http://localhost:3100";
const EXT_ORIGIN = "chrome-extension://fkdfojkjedbkikagcmgpioacioojelja";
const EVIL_ORIGIN = "https://evil.example";

let pass = 0;
let fail = 0;
function ok(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const VALID = {
  videoId: "dQw4w9WgXcQ",
  sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  videoTitle: "Harry Kane Movement Analysis",
  channelName: "Football IQ",
  thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  timestampSeconds: 2057,
  observation: "Checks away first, waits for the CB to look at the ball, then attacks the blindside.",
  category: "movement",
};

async function post(body, origin = EXT_ORIGIN) {
  return fetch(`${base}/api/extension/captures`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

console.log(`\nExtension API against ${base}\n`);

/* ── session ─────────────────────────────────────────────── */
console.log("SESSION");
{
  const res = await fetch(`${base}/api/extension/session`, { headers: { origin: EXT_ORIGIN } });
  const body = await res.json();
  ok("answers 200 with an extension Origin", res.status === 200, `status ${res.status}`);
  ok("reflects the extension origin in ACAO", res.headers.get("access-control-allow-origin") === EXT_ORIGIN);
  ok("allows credentials", res.headers.get("access-control-allow-credentials") === "true");
  ok("reports authentication state", typeof body.authenticated === "boolean");
  if (body.authenticated) {
    ok("carries goals", Array.isArray(body.goals));
    ok("carries the app url", typeof body.appUrl === "string");
  } else {
    console.log("  · not signed in (real mode without cookies) — capture tests will expect 401");
  }

  const evil = await fetch(`${base}/api/extension/session`, { headers: { origin: EVIL_ORIGIN } });
  ok("refuses a web Origin with 403", evil.status === 403, `status ${evil.status}`);

  const pre = await fetch(`${base}/api/extension/session`, {
    method: "OPTIONS",
    headers: { origin: EXT_ORIGIN, "access-control-request-method": "GET" },
  });
  ok("answers preflight 204", pre.status === 204, `status ${pre.status}`);

  var authenticated = body.authenticated === true;
  var demo = body.demo === true;
  var demoGoalId = authenticated && body.goals?.[0]?.id ? body.goals[0].id : null;
}

/* ── capture validation (auth-independent where possible) ── */
console.log("\nCAPTURE — validation");
{
  const evil = await post(VALID, EVIL_ORIGIN);
  ok("refuses a web Origin with 403", evil.status === 403, `status ${evil.status}`);

  const bad = await post("{not json", EXT_ORIGIN);
  ok("refuses malformed JSON with 400", bad.status === 400, `status ${bad.status}`);

  const huge = await post({ ...VALID, observation: "x".repeat(30000) });
  ok("refuses an oversized body", huge.status === 400 || huge.status === 422, `status ${huge.status}`);
}

if (!authenticated) {
  console.log("\nNot signed in — skipping persistence tests (run against demo mode for the full loop).");
} else {
  console.log("\nCAPTURE — persistence" + (demo ? " (demo mode)" : ""));

  for (const [name, mutate, field] of [
    ["bad video id", { videoId: "nope" }, "videoId"],
    ["url naming a different video", { sourceUrl: "https://www.youtube.com/watch?v=AAAAAAAAAAA" }, "sourceUrl"],
    ["empty observation", { observation: "   " }, "observation"],
    ["observation past the cap", { observation: "x".repeat(1001) }, "observation"],
    ["unknown category", { category: "swagger" }, "category"],
    ["non-YouTube thumbnail", { thumbnailUrl: "https://evil.example/x.jpg" }, "thumbnailUrl"],
    ["negative timestamp", { timestampSeconds: -4 }, "timestampSeconds"],
    ["timestamp past 12h", { timestampSeconds: 99999 }, "timestampSeconds"],
  ]) {
    const res = await post({ ...VALID, ...mutate });
    const body = await res.json().catch(() => ({}));
    ok(`422 for ${name}`, res.status === 422 && body.field === field, `status ${res.status} field ${body.field}`);
  }

  const clientKey = `verify-${Math.random().toString(36).slice(2, 10)}`;
  const first = await post({ ...VALID, clientKey, goalId: demoGoalId });
  const firstBody = await first.json();
  ok("saves a valid capture", first.status === 200 && firstBody.ok === true, `status ${first.status}`);
  ok("returns an id and openUrl", typeof firstBody.id === "string" && typeof firstBody.openUrl === "string");

  const second = await post({ ...VALID, clientKey, goalId: demoGoalId });
  const secondBody = await second.json();
  ok("dedupes a repeat clientKey", secondBody.ok === true && secondBody.deduped === true,
    JSON.stringify(secondBody));

  if (demo) {
    const wrongGoal = await post({ ...VALID, clientKey: `${clientKey}-g`, goalId: "gZZZ" });
    ok("demo accepts unknown goal shape (ownership is a live-db check)", (await wrongGoal.json()).ok === true);
  }

  /* ── surfacing ─────────────────────────────────────────── */
  console.log("\nFILM ROOM — surfacing");
  const page = await fetch(`${base}/app/film-room?moment=${firstBody.id}`);
  const html = await page.text();
  ok("film room renders", page.status === 200, `status ${page.status}`);
  ok("saved moment appears", html.includes("Saved moments"), "section missing");
  ok("observation text appears", html.includes("attacks the blindside"), "observation missing");
  ok("timestamp appears", html.includes("34:17"), "timestamp missing");

  if (demoGoalId) {
    const goalPage = await fetch(`${base}/app/development/${demoGoalId}`);
    const goalHtml = await goalPage.text();
    ok("goal page renders", goalPage.status === 200, `status ${goalPage.status}`);
    ok("study moment appears on the goal", goalHtml.includes("Study moments"), "section missing");
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
