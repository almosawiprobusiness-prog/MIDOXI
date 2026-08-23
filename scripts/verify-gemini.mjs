#!/usr/bin/env node
/*
  Check a Gemini key before it goes anywhere near production.

  Two things worth knowing, and neither is visible from the key itself:

  1. Does the key work at all, and is the Generative Language API enabled on
     the project behind it? A key that exists but has the API switched off
     fails at the first real call, which in MIDO XI means a player waiting on
     a film read that was never going to happen.

  2. Does the model MIDO defaults to still exist? `lib/video/gemini.ts` pins
     `gemini-3.6-flash` unless GEMINI_VIDEO_MODEL says otherwise. Model ids move
     faster than deployments do, and a stale default is a 404 at the worst
     moment. This lists what the key can actually reach, so the default is
     chosen from the catalogue rather than from memory.

  Read-only: it lists models and makes one tiny text call. No video is uploaded
  and nothing is stored on Google's side.

  Run it yourself so the key never leaves your machine:

      GEMINI_API_KEY=... node scripts/verify-gemini.mjs
*/

const KEY = process.env.GEMINI_API_KEY;
const WANT = process.env.GEMINI_VIDEO_MODEL || "gemini-3.6-flash";
const BASE = "https://generativelanguage.googleapis.com";

if (!KEY) {
  console.error("GEMINI_API_KEY is not set.\n");
  console.error("  GEMINI_API_KEY=... node scripts/verify-gemini.mjs");
  console.error("\nGet one at https://aistudio.google.com/apikey");
  process.exit(1);
}
if (KEY.length < 20) {
  console.error(`That does not look like an API key (${KEY.length} characters).`);
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`${BASE}/${path}`, {
    ...init,
    headers: { "x-goog-api-key": KEY, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* an HTML error page is itself the answer */
  }
  return { status: res.status, json, text };
};

// ── 1 · does the key work ────────────────────────────────────────────────────
console.log("\nchecking the key…");
const list = await api("v1beta/models?pageSize=200");

if (list.status === 400 || list.status === 403) {
  const msg = list.json?.error?.message ?? list.text.slice(0, 200);
  console.error(`\n  The key was refused (${list.status}).`);
  console.error(`  ${msg}\n`);
  if (/API has not been used|disabled|SERVICE_DISABLED/i.test(msg)) {
    console.error("  The key is valid but the Generative Language API is not enabled");
    console.error("  on its Google Cloud project. Enable it, then re-run this.");
  } else {
    console.error("  Check the key at https://aistudio.google.com/apikey");
  }
  process.exit(1);
}
if (list.status !== 200) {
  console.error(`\n  Unexpected response (${list.status}): ${list.text.slice(0, 200)}`);
  process.exit(1);
}
console.log("  ok    the key works");

// ── 2 · which models it can reach ────────────────────────────────────────────
const models = (list.json?.models ?? [])
  .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
  .map((m) => String(m.name).replace(/^models\//, ""));

const flash = models.filter((m) => /flash/i.test(m) && !/image|tts|live|embedding/i.test(m));
console.log(`  ok    ${models.length} models reachable`);

const has = models.includes(WANT);
if (has) {
  console.log(`  ok    ${WANT} exists — MIDO's default is current`);
} else {
  console.log(`  FAIL  ${WANT} is NOT in the catalogue`);
  console.log("\n        MIDO XI would 404 on every film read. Pick one of these and set");
  console.log("        GEMINI_VIDEO_MODEL to it, in Vercel and in .env.local:\n");
  for (const m of flash.slice(0, 12)) console.log(`          ${m}`);
  process.exit(1);
}

// ── 3 · one real call ────────────────────────────────────────────────────────
/*
  Listing models proves the key is shaped right. It does not prove the key can
  actually generate — quota, billing and per-model access are separate. One
  two-token call settles it for a fraction of a cent.
*/
console.log("\nmaking one small call…");
const gen = await api(`v1beta/models/${WANT}:generateContent`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "Reply with the single word: ready" }] }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0 },
  }),
});

if (gen.status !== 200) {
  const msg = gen.json?.error?.message ?? gen.text.slice(0, 200);
  console.error(`  FAIL  the call was refused (${gen.status})`);
  console.error(`        ${msg}`);
  if (gen.status === 429) {
    console.error("\n        Rate limited. The key works; the project has no headroom right now.");
  }
  process.exit(1);
}

const candidate = gen.json?.candidates?.[0];
const reply = candidate?.content?.parts?.map((p) => p.text ?? "").join("").trim();
const used = gen.json?.usageMetadata ?? {};
const thoughts = used.thoughtsTokenCount ?? 0;
const visible = used.candidatesTokenCount ?? 0;

/*
  A 200 is not an answer.

  This check used to print "ok, it generates" on an empty reply, because it only
  looked at the status code. Empty content with finishReason MAX_TOKENS is the
  specific way this model fails, and reporting it as a pass is worse than not
  checking at all.
*/
if (!reply) {
  console.error("  FAIL  it returned 200 but generated nothing");
  console.error(`        finishReason ${candidate?.finishReason}, ${thoughts} thinking tokens, ${visible} visible`);
  if (candidate?.finishReason === "MAX_TOKENS") {
    console.error("\n        The whole token budget went on thinking before any answer appeared.");
    console.error("        Raise maxOutputTokens in lib/video/gemini.ts.");
  }
  process.exit(1);
}

console.log(`  ok    it generates - replied "${reply}"`);
console.log(`        ${used.promptTokenCount ?? 0} in | ${visible} visible | ${thoughts} thinking`);
if (thoughts > visible) {
  console.log("        note: this model thinks more than it says, and thinking is billed");
  console.log("        as output and charged against maxOutputTokens. lib/video/gemini.ts");
  console.log("        budgets 6000 for a film read and records both halves.");
}

console.log(`\nThis key is good for MIDO XI film reading, on ${WANT}.`);
console.log("Add it to Vercel as GEMINI_API_KEY, then redeploy.\n");
