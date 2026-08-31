#!/usr/bin/env node
/*
  MIDO VISION accuracy benchmark — §2 of the accuracy pass: no "it feels
  better". Same passages, one variable changed at a time, everything recorded.

  Speaks to the PRODUCTION backend (Vertex, project-bound endpoint) with the
  PRODUCTION prompt and schema, lifted from lib/video/native-video.ts at
  runtime exactly like try-film-read.mjs does — so a config here is a config
  the product could actually ship.

  Ground truth and passage boundaries: scratch-vision/ground-truth.md
  (frame-inspected, owner's own footage).

  Usage:
    node scripts/vision-bench.mjs probe            # which models answer on Vertex
    node scripts/vision-bench.mjs run A p1         # one config, one passage
    node scripts/vision-bench.mjs run A            # one config, all passages
    node scripts/vision-bench.mjs summary          # table from saved results

  Results land in scratch-vision/results/<config>-<passage>.json — raw model
  output plus latency and token usage, so scoring is repeatable and auditable.
*/
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";

// ── env, straight from .env.local like the other verify scripts ─────────────
function env() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const E = env();
const PROJECT = E.VERTEX_PROJECT_ID;
const KEY = E.VERTEX_API_KEY;
if (!PROJECT || !KEY) {
  console.error("VERTEX_PROJECT_ID / VERTEX_API_KEY missing from .env.local");
  process.exit(1);
}
const endpoint = (model) =>
  `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;

// ── the production prompt + schema, lifted not copied ───────────────────────
const src = readFileSync(new URL("../lib/video/native-video.ts", import.meta.url), "utf8");
const SYSTEM = src.match(/const SYSTEM = `([\s\S]*?)`;/)?.[1];
const schemaSrc = src.match(/const SCHEMA = (\{[\s\S]*?\}) as const;/)?.[1];
if (!SYSTEM || !schemaSrc) throw new Error("Could not lift SYSTEM/SCHEMA from native-video.ts");
const SCHEMA = new Function(`return ${schemaSrc}`)();

const YT = "https://www.youtube.com/watch?v=rolfkUn2C-o";
const CONCEPTS = [
  { slug: "blindside-movement", name: "Blindside movement" },
  { slug: "runs-in-behind", name: "Running in behind" },
  { slug: "pressing-triggers", name: "Pressing triggers" },
];

/*
  The four passages. `yt` offsets are absolute in the source video; `file`
  clips are pre-cut to the same boundaries, so both lanes watch the same
  football (§39 demands exactly this).
*/
const PASSAGES = {
  p1: {
    yt: [18, 36],
    file: "scratch-vision/clips/p1-buildup.mp4",
    len: 18,
    lookingFor: "Movement off the ball, pressing moments, and build-up direction.",
    identity: "Royal blue shirt, number 10, Spring Lake Park. Central attacker.",
  },
  p2: {
    yt: [42, 57],
    file: "scratch-vision/clips/p2-setpiece.mp4",
    len: 15,
    lookingFor: "The set piece: who takes it, the wall, the delivery and what happens in the box.",
    identity: "White shirt, number 10, Spring Lake Park. Attacker.",
  },
  p3: {
    yt: [58, 71],
    file: "scratch-vision/clips/p3-green.mp4",
    len: 13,
    lookingFor: "Attacking movement and support around the ball carrier.",
    // Deliberately wrong for this clip (no blue team exists) — golden test 5.
    identity: "Royal blue shirt, number 10, Spring Lake Park. Central attacker.",
  },
  p4: {
    yt: [157, 168],
    file: "scratch-vision/clips/p4-goalmouth.mp4",
    len: 11,
    lookingFor: "The drive at goal and how the chance ends.",
    identity: "White shirt, Spring Lake Park attacker — the player driving at goal.",
  },
};

/*
  One variable at a time (§6). B adds identity to A; C adds resolution to B;
  D swaps the model under B; F swaps the source under B; G is the best-quality
  candidate (pro + file + high res).
*/
const CONFIGS = {
  A: { model: "gemini-2.5-flash", source: "yt", identity: false, res: null, note: "production baseline" },
  B: { model: "gemini-2.5-flash", source: "yt", identity: true, res: null, note: "+ pitch identity" },
  C: { model: "gemini-2.5-flash", source: "yt", identity: true, res: "MEDIA_RESOLUTION_MEDIUM", note: "+ high media resolution" },
  D: { model: "gemini-2.5-pro", source: "yt", identity: true, res: null, note: "pro model, youtube" },
  E: { model: "gemini-3.7-flash", source: "yt", identity: true, res: null, note: "newest flash, youtube" },
  F: { model: "gemini-2.5-flash", source: "file", identity: true, res: null, note: "direct upload" },
  G: { model: "gemini-2.5-pro", source: "file", identity: true, res: "MEDIA_RESOLUTION_MEDIUM", note: "pro + upload + high res" },
  H: { model: "gemini-3.7-flash", source: "file", identity: true, res: null, note: "newest flash, upload" },
};

const mmss = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function buildBody(cfg, p) {
  const parts = [];
  if (cfg.source === "yt") {
    parts.push({
      fileData: { fileUri: YT, mimeType: "video/mp4" },
      videoMetadata: { startOffset: `${p.yt[0]}s`, endOffset: `${p.yt[1]}s` },
    });
  } else {
    const bytes = readFileSync(new URL(`../${p.file}`, import.meta.url));
    parts.push({ inlineData: { mimeType: "video/mp4", data: bytes.toString("base64") } });
  }
  const from = cfg.source === "yt" ? p.yt[0] : 0;
  const to = cfg.source === "yt" ? p.yt[1] : p.len;
  parts.push({
    text: JSON.stringify({
      watch: `From ${mmss(from)} to ${mmss(to)}.`,
      lookingFor: p.lookingFor,
      viewer: {
        role: "player",
        position: "CF",
        onThePitch: cfg.identity
          ? p.identity
          : "NOT STATED — you do not know which player this is. Write about the passage and mark identity-dependent observations uncertain.",
      },
      curatedConcepts: CONCEPTS,
      earlierObservations: [],
    }),
  });

  const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: SCHEMA,
    maxOutputTokens: 6000,
    temperature: 0.3,
  };
  if (cfg.res) generationConfig.mediaResolution = cfg.res;

  return {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig,
  };
}

async function callVertex(model, body) {
  const started = Date.now();
  const res = await fetch(endpoint(model), {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, ms: Date.now() - started };
}

async function runOne(configId, passageId) {
  const cfg = CONFIGS[configId];
  const p = PASSAGES[passageId];
  const out = await callVertex(cfg.model, buildBody(cfg, p));

  const u = out.json.usageMetadata ?? {};
  const text = out.json.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* recorded raw below */
  }

  const record = {
    configId,
    passageId,
    model: cfg.model,
    source: cfg.source,
    identity: cfg.identity,
    mediaResolution: cfg.res,
    status: out.status,
    latencyMs: out.ms,
    finishReason: out.json.candidates?.[0]?.finishReason ?? null,
    usage: {
      promptTokens: u.promptTokenCount ?? 0,
      thinkingTokens: u.thoughtsTokenCount ?? 0,
      outputTokens: u.candidatesTokenCount ?? 0,
      total: u.totalTokenCount ?? 0,
      detail: u.promptTokensDetails ?? null,
    },
    error: out.status !== 200 ? (out.json?.error?.message ?? "").slice(0, 400) : null,
    result: data,
    rawText: data ? undefined : text.slice(0, 2000),
    at: new Date().toISOString(),
  };

  mkdirSync(new URL("../scratch-vision/results/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL(`../scratch-vision/results/${configId}-${passageId}.json`, import.meta.url),
    JSON.stringify(record, null, 2),
  );

  const obs = data?.observations?.length ?? 0;
  console.log(
    `${configId}-${passageId}  ${cfg.model}  ${cfg.source}  ${out.status}  ${out.ms}ms  in=${record.usage.promptTokens} think=${record.usage.thinkingTokens} out=${record.usage.outputTokens}  obs=${obs}${record.error ? `  ERR ${record.error.slice(0, 120)}` : ""}`,
  );
  return record;
}

// ── commands ────────────────────────────────────────────────────────────────
const [cmd, a1, a2] = process.argv.slice(2);

if (cmd === "probe") {
  // Which model IDs actually answer on this Vertex project — §42 before pinning.
  const candidates = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3-flash",
    "gemini-3.1-pro","gemini-3.1-pro-001","gemini-3-pro-preview","gemini-3.0-pro",
  ];
  for (const m of candidates) {
    const out = await callVertex(m, {
      contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }],
      generationConfig: { maxOutputTokens: 5 },
    });
    console.log(
      `${m.padEnd(20)} ${out.status}${out.status !== 200 ? `  ${(out.json?.error?.message ?? "").slice(0, 90)}` : `  ${out.ms}ms`}`,
    );
  }
} else if (cmd === "run") {
  const cfg = CONFIGS[a1];
  if (!cfg) {
    console.error(`Unknown config ${a1}. Known: ${Object.keys(CONFIGS).join(", ")}`);
    process.exit(1);
  }
  const passages = a2 ? [a2] : Object.keys(PASSAGES);
  for (const pid of passages) {
    await runOne(a1, pid);
  }
} else if (cmd === "summary") {
  const dir = new URL("../scratch-vision/results/", import.meta.url);
  if (!existsSync(dir)) {
    console.log("No results yet.");
    process.exit(0);
  }
  const rows = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")));
  rows.sort((x, y) => (x.configId + x.passageId).localeCompare(y.configId + y.passageId));
  for (const r of rows) {
    console.log(
      `${r.configId}-${r.passageId}  ${String(r.status).padEnd(4)} ${String(r.latencyMs).padStart(6)}ms  in=${String(r.usage.promptTokens).padStart(6)} think=${String(r.usage.thinkingTokens).padStart(5)} out=${String(r.usage.outputTokens).padStart(5)}  obs=${r.result?.observations?.length ?? "-"}  ${r.error ? "ERR " + r.error.slice(0, 60) : ""}`,
    );
  }
} else {
  console.log("Usage: vision-bench.mjs probe | run <config> [passage] | summary");
}
