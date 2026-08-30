#!/usr/bin/env node
/*
  Verify the Vertex (Gemini Enterprise Agent Platform) backend — from
  outside the app, against the real project.

    1. Auth + endpoint: a text-only generateContent answers on the
       project-bound global endpoint with the API key.
    2. The model id the app defaults to actually exists there.
    3. Video: a short public YouTube clip is read with videoMetadata
       clipping — the exact request shape lib/video/gemini.ts sends.
    4. Inline bytes: a tiny inline payload is accepted (the vertex
       upload lane's mechanism), using audio to keep it small.

  Usage: node scripts/verify-vertex.mjs
  Reads VERTEX_API_KEY / VERTEX_PROJECT_ID / VERTEX_LOCATION (default
  global) and GEMINI_VIDEO_MODEL from .env.local.
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

const e = env();
const KEY = e.VERTEX_API_KEY;
const PROJECT = e.VERTEX_PROJECT_ID;
const LOCATION = e.VERTEX_LOCATION || "global";
const MODEL = e.GEMINI_VIDEO_MODEL || "gemini-3.6-flash";

if (!KEY || !PROJECT) {
  console.error("Set VERTEX_API_KEY and VERTEX_PROJECT_ID in .env.local first.");
  process.exit(1);
}

const host = LOCATION === "global" ? "aiplatform.googleapis.com" : `${LOCATION}-aiplatform.googleapis.com`;
const url = `https://${host}/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

async function call(body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* body may be empty on some errors */
  }
  return { status: res.status, json };
}

console.log(`Endpoint: ${url}\n`);

// 1+2 · text-only: auth, endpoint shape, model existence in one probe.
const text = await call({
  contents: [{ role: "user", parts: [{ text: "Reply with exactly: ok" }] }],
  generationConfig: { maxOutputTokens: 200, temperature: 0 },
});
const textOut = text.json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
check(
  "text generateContent answers (auth + endpoint + model)",
  text.status === 200 && textOut.toLowerCase().includes("ok"),
  `status ${text.status}${text.json?.error ? ` · ${JSON.stringify(text.json.error).slice(0, 200)}` : ` · "${textOut.slice(0, 40)}"`}`,
);

// 3 · a public YouTube clip with videoMetadata clipping — the app's shape.
const video = await call({
  contents: [
    {
      role: "user",
      parts: [
        {
          fileData: { fileUri: "https://www.youtube.com/watch?v=9hE5-98ZeCg", mimeType: "video/mp4" },
          videoMetadata: { startOffset: "0s", endOffset: "20s" },
        },
        { text: "In one short sentence, what is visible in this clip?" },
      ],
    },
  ],
  generationConfig: { maxOutputTokens: 2000, temperature: 0 },
});
const videoOut = video.json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
check(
  "YouTube video read with videoMetadata clipping",
  video.status === 200 && videoOut.length > 0,
  `status ${video.status}${video.json?.error ? ` · ${JSON.stringify(video.json.error).slice(0, 250)}` : ` · "${videoOut.slice(0, 80)}"`}`,
);

// 4 · inline bytes lane (tiny silent WAV — the mechanism, not the size).
const wav = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from(Uint32Array.of(36 + 8000).buffer),
  Buffer.from("WAVEfmt "),
  Buffer.from(Uint32Array.of(16).buffer),
  Buffer.from(Uint16Array.of(1, 1).buffer),
  Buffer.from(Uint32Array.of(8000, 8000).buffer),
  Buffer.from(Uint16Array.of(1, 8).buffer),
  Buffer.from("data"),
  Buffer.from(Uint32Array.of(8000).buffer),
  Buffer.alloc(8000, 128),
]);
const inline = await call({
  contents: [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } },
        { text: "Reply with exactly: heard" },
      ],
    },
  ],
  generationConfig: { maxOutputTokens: 200, temperature: 0 },
});
check(
  "inline bytes accepted (the vertex upload lane's mechanism)",
  inline.status === 200,
  `status ${inline.status}${inline.json?.error ? ` · ${JSON.stringify(inline.json.error).slice(0, 200)}` : ""}`,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
