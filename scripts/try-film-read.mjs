#!/usr/bin/env node
/*
  Point the real film reader at real football and print what comes back.

  Not a unit test — a look. The prompt and the schema are lifted out of
  `lib/video/native-video.ts` at runtime rather than copied, so this exercises
  what actually ships. Everything else mirrors the provider: the same model, the
  same token budget, the same videoMetadata clipping, the same identity hint.

  It runs the same passage twice — once told who the viewer is, once not — because
  the single most important behaviour in this feature is what MIDO does when it
  cannot tell which player is yours. It is supposed to write about the passage
  and mark things uncertain. This is where we find out if it does.

      GEMINI_API_KEY=... node scripts/try-film-read.mjs <youtubeUrl> <fromSec> <toSec>

  Costs a fraction of a cent per run and writes nothing anywhere.
*/
import { readFileSync } from "node:fs";

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_VIDEO_MODEL || "gemini-3.6-flash";
if (!KEY) {
  console.error("GEMINI_API_KEY is not set.");
  process.exit(1);
}

const [urlArg, fromArg, toArg] = process.argv.slice(2);
const URL_ = urlArg ?? "https://www.youtube.com/watch?v=CNhrwaChUAA";
const FROM = Number(fromArg ?? 1800);
const TO = Number(toArg ?? 1845);

// ── lift the real prompt and schema out of the provider ──────────────────────
const src = readFileSync(new URL("../lib/video/native-video.ts", import.meta.url), "utf8");

const SYSTEM = src.match(/const SYSTEM = `([\s\S]*?)`;/)?.[1];
if (!SYSTEM) throw new Error("Could not find SYSTEM in native-video.ts — has it been renamed?");

const schemaSrc = src.match(/const SCHEMA = (\{[\s\S]*?\}) as const;/)?.[1];
if (!schemaSrc) throw new Error("Could not find SCHEMA in native-video.ts.");
const SCHEMA = new Function(`return ${schemaSrc}`)();

// The curated concepts a striker would be working on, as the provider passes them.
const CONCEPTS = [
  { slug: "blindside-movement", name: "Blindside movement" },
  { slug: "runs-in-behind", name: "Running in behind" },
  { slug: "dropping-between-lines", name: "Dropping between the lines" },
];

const mmss = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function read({ identity, prior }) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: { fileUri: URL_, mimeType: "video/mp4" },
            videoMetadata: { startOffset: `${FROM}s`, endOffset: `${TO}s` },
          },
          {
            text: JSON.stringify({
              watch: `From ${mmss(FROM)} to ${mmss(TO)}.`,
              lookingFor: "Movement off the ball and body shape before receiving.",
              viewer: {
                role: "player",
                position: "CF",
                onThePitch:
                  identity ||
                  "NOT STATED — you do not know which player this is. Write about the passage and mark identity-dependent observations uncertain.",
              },
              curatedConcepts: CONCEPTS,
              earlierObservations: prior,
            }),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      maxOutputTokens: 6000,
      temperature: 0.3,
    },
  };

  const started = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = await res.json();
  return { status: res.status, json, ms: Date.now() - started };
}

function show(label, out) {
  console.log(`\n${"─".repeat(72)}\n${label}\n${"─".repeat(72)}`);
  if (out.status !== 200) {
    console.log(`FAILED ${out.status}: ${out.json?.error?.message ?? JSON.stringify(out.json).slice(0, 300)}`);
    return null;
  }
  const c = out.json.candidates?.[0];
  const u = out.json.usageMetadata ?? {};
  const text = c?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  console.log(
    `finish=${c?.finishReason}  ${out.ms}ms  ` +
      `in=${u.promptTokenCount ?? 0} (video) · thinking=${u.thoughtsTokenCount ?? 0} · visible=${u.candidatesTokenCount ?? 0}`,
  );

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log(`\nCOULD NOT PARSE:\n${text.slice(0, 400)}`);
    return null;
  }

  console.log(`\nidentified: ${data.identified}`);
  console.log(`summary: ${data.summary}\n`);
  for (const o of data.observations ?? []) {
    console.log(`  [${mmss(o.atSeconds)}] ${(o.confidence ?? "?").toUpperCase().padEnd(9)} ${o.title}`);
    console.log(`           ${o.body}`);
    if (o.concept) console.log(`           concept: ${o.concept}`);
    console.log();
  }
  const counts = {};
  for (const o of data.observations ?? []) counts[o.confidence ?? "?"] = (counts[o.confidence ?? "?"] ?? 0) + 1;
  console.log(`  ${data.observations?.length ?? 0} observations — ${JSON.stringify(counts)}`);
  return data;
}

console.log(`\nvideo:  ${URL_}`);
console.log(`window: ${mmss(FROM)}–${mmss(TO)}  (${TO - FROM}s)`);
console.log(`model:  ${MODEL}`);

const withId = await read({ identity: "Number 9, blue and white striped shirts, plays centre-forward" });
show("WITH an identity hint  (the normal case, once a player fills in Settings)", withId);

const without = await read({ identity: null });
show("WITHOUT an identity hint  (what MIDO does when it does not know you)", without);
console.log();
