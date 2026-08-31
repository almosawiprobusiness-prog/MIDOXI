import "server-only";
import { env } from "@/lib/env";

/*
  ============================================================
  GEMINI — the only model family that reads video natively
  ------------------------------------------------------------
  Claude reads images. It does not read video, and MIDO's frame
  reader exists because of that: twelve stills over a few seconds,
  described honestly as stills.

  Reading the clip itself is a different capability, and today it
  needs a different provider. This is a small REST client for it —
  no SDK, because the surface used here is three endpoints and a
  dependency is not worth it.

    upload      resumable upload of a video file
    waitReady   files are PROCESSING before they are ACTIVE
    generate    generateContent with a JSON response schema

  Nothing in here decides anything about football. It moves bytes
  and returns tokens. The judgement lives in native-video.ts.
  ============================================================
*/

const BASE = "https://generativelanguage.googleapis.com";

/**
 * The model id is configurable because model names move faster than
 * deployments do. The default is the current general Flash model; a deployment
 * that wants the cheaper lite variant sets GEMINI_VIDEO_MODEL and the provider
 * reports whichever it actually used.
 */
/*
  Benchmarked 2026-08-30 (scripts/vision-bench.mjs, four frame-verified
  passages of real footage): gemini-3.7-flash never false-attributed a
  player in eight runs, matched or beat gemini-2.5-flash on football
  facts, uses ~45% of its video input tokens, and — unlike 3.6-flash —
  reads YouTube through Vertex without the 500. So it is the default,
  and the previous default that silently broke on the production
  backend is gone.
*/
export const VIDEO_MODEL = env.geminiVideoModel || "gemini-3.7-flash";

/*
  The deep-read model. gemini-2.5-pro produced the sharpest football
  description in the benchmark (it was the only config to name the
  referee trap unprompted, and its goal reads matched the frames) at
  ~2.5× the latency. Selected per-read, never globally.
*/
export const DEEP_VIDEO_MODEL = env.geminiVideoModelDeep || "gemini-2.5-pro";

/*
  ── TWO BACKENDS, ONE DIALECT ──────────────────────────────────────
  The same Gemini models are served by two platforms with different
  TERMS: the consumer AI Studio API (whose terms bar services directed
  at under-18s — disqualifying for a youth football product) and
  Vertex AI / the Gemini Enterprise Agent Platform (enterprise terms).
  The request and response bodies are the same dialect; what differs is
  the host, the URL shape, and what exists around generateContent:

    studio   generativelanguage.googleapis.com — has the Files API
             (48h scratch uploads). The original backend.
    vertex   aiplatform.googleapis.com, project-bound — NO Files API.
             Video arrives as a YouTube URL or inline bytes; large
             uploads would need a GCS bucket, which is deliberately
             not built until something needs it.

  Vertex wins when fully configured, so a deployment MIGRATES BY
  ADDING env vars and rolls back by removing them. Nothing else in the
  product knows which backend answered.
*/
export type GeminiBackend =
  | { kind: "studio"; key: string }
  | { kind: "vertex"; key: string; project: string; location: string };

export function geminiBackend(): GeminiBackend | null {
  if (env.vertexKey && env.vertexProject) {
    return { kind: "vertex", key: env.vertexKey, project: env.vertexProject, location: env.vertexLocation };
  }
  if (env.geminiKey) return { kind: "studio", key: env.geminiKey };
  return null;
}

/** The generateContent URL for the active backend. */
export function generateContentEndpoint(model: string = VIDEO_MODEL): string | null {
  const b = geminiBackend();
  if (!b) return null;
  if (b.kind === "studio") return `${BASE}/v1beta/models/${model}:generateContent`;
  const host =
    b.location === "global" ? "aiplatform.googleapis.com" : `${b.location}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${b.project}/locations/${b.location}/publishers/google/models/${model}:generateContent`;
}

/** Auth headers for the active backend — both speak x-goog-api-key. */
export function generateContentHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const b = geminiBackend();
  return { "x-goog-api-key": b?.key ?? "", ...extra };
}

/**
 * Whether the active backend has the Files API. Only studio does; on
 * vertex an upload travels inline instead, under INLINE_MAX_BYTES.
 */
export function filesApiAvailable(): boolean {
  return geminiBackend()?.kind === "studio";
}

/**
 * The inline-bytes ceiling for the vertex lane. Conservative on
 * purpose: base64 inflates by 4/3 and the whole request must clear the
 * platform's request-size limit; 12MB of video becomes a ~16MB body.
 * Raise only after a larger read has been PROVEN against the live
 * endpoint, not because a docs page suggests more would fit.
 */
export const INLINE_MAX_BYTES = 12 * 1024 * 1024;

/**
 * Fetch an upload and return it as inline base64 for a vertex read.
 * Refuses over the ceiling with the honest alternative, because the
 * alternative genuinely works (YouTube links have no size ceiling).
 */
export async function inlineFromUrl(
  sourceUrl: string,
): Promise<GeminiOutcome<{ base64: string; mimeType: string }>> {
  let source: Response;
  try {
    source = await fetch(sourceUrl);
  } catch {
    return { ok: false, error: "The video could not be read from storage." };
  }
  if (!source.ok) {
    return { ok: false, error: `The video could not be read from storage (${source.status}).` };
  }
  const length = Number(source.headers.get("content-length") ?? 0);
  if (!length) {
    source.body?.cancel();
    return { ok: false, error: "The video source did not report its size, so it cannot be read." };
  }
  if (length > INLINE_MAX_BYTES) {
    source.body?.cancel();
    return {
      ok: false,
      error: `That file is ${(length / 1024 / 1024).toFixed(0)}MB. On this deployment's video backend uploads up to ${INLINE_MAX_BYTES / 1024 / 1024}MB can be read directly — trim the clip, or add the footage as a YouTube link, which has no size ceiling.`,
    };
  }
  const bytes = Buffer.from(await source.arrayBuffer());
  return {
    ok: true,
    value: {
      base64: bytes.toString("base64"),
      mimeType: source.headers.get("content-type") || "video/mp4",
    },
  };
}

/**
 * Uploaded sources are fetched by the server and forwarded. That is fine for a
 * clip and impossible for a full match: a 4.5GB file will not move through a
 * request-scoped function, and pretending otherwise would mean a spinner that
 * never resolves. Above this, the provider says exactly what to do instead.
 */
export const MAX_SOURCE_BYTES = 200 * 1024 * 1024;

/** Files the API holds expire on their side. Re-upload before we get close. */
export const FILE_TTL_HOURS = 47;

export function geminiConfigured(): boolean {
  return geminiBackend() !== null;
}

/** Studio-only headers, for the Files API endpoints below. */
function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { "x-goog-api-key": env.geminiKey, ...extra };
}

export interface GeminiFile {
  /** `files/abc123` — the handle, not a URL. */
  name: string;
  /** The URI a generateContent part refers to. */
  uri: string;
  mimeType: string;
  state: "PROCESSING" | "ACTIVE" | "FAILED";
  sizeBytes?: number;
}

export type GeminiOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Fetch a video from `sourceUrl` and hand it to the Files API.
 *
 * The body is streamed straight through rather than buffered — a 200MB
 * Buffer in a request-scoped function is how a deploy runs out of memory
 * under two concurrent users.
 */
export async function uploadFromUrl(
  sourceUrl: string,
  displayName: string,
): Promise<GeminiOutcome<GeminiFile>> {
  if (!filesApiAvailable()) {
    // The vertex backend has no Files API — callers route uploads
    // through inlineFromUrl instead. Reaching here is a caller bug.
    return { ok: false, error: "Video model is not configured for file uploads." };
  }

  let source: Response;
  try {
    source = await fetch(sourceUrl);
  } catch {
    return { ok: false, error: "The video could not be read from storage." };
  }
  if (!source.ok || !source.body) {
    return { ok: false, error: `The video could not be read from storage (${source.status}).` };
  }

  const length = Number(source.headers.get("content-length") ?? 0);
  const mimeType = source.headers.get("content-type") || "video/mp4";

  if (!length) {
    // Without a length there is no resumable upload, and no way to check the
    // size before committing to it. Refuse rather than stream blind.
    source.body.cancel();
    return { ok: false, error: "The video source did not report its size, so it cannot be uploaded." };
  }
  if (length > MAX_SOURCE_BYTES) {
    source.body.cancel();
    return {
      ok: false,
      error: `That file is ${(length / 1024 / 1024).toFixed(0)}MB. Native video reading handles up to ${MAX_SOURCE_BYTES / 1024 / 1024}MB — trim the clip, or add the match as a link instead of an upload.`,
    };
  }

  // 1 · open a resumable session
  const start = await fetch(`${BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: headers({
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ file: { display_name: displayName.slice(0, 120) } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) {
    source.body.cancel();
    return { ok: false, error: `Upload could not be started (${start.status}).` };
  }

  // 2 · send the bytes
  const put = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: source.body,
    // Required by undici whenever the body is a stream.
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  if (!put.ok) return { ok: false, error: `The upload did not complete (${put.status}).` };

  const json = (await put.json()) as { file?: Record<string, unknown> };
  const file = json.file;
  if (!file?.uri) return { ok: false, error: "The upload completed but returned no file." };

  return {
    ok: true,
    value: {
      name: String(file.name ?? ""),
      uri: String(file.uri),
      mimeType: String(file.mimeType ?? mimeType),
      state: (file.state as GeminiFile["state"]) ?? "PROCESSING",
      sizeBytes: length,
    },
  };
}

/**
 * A freshly uploaded video is PROCESSING, not ACTIVE. Referring to it too early
 * fails with an unhelpful error, so wait — with a ceiling, because a file that
 * never becomes ACTIVE has failed and the user needs to hear that rather than
 * watch a spinner.
 */
export async function waitReady(name: string, timeoutMs = 90_000): Promise<GeminiOutcome<GeminiFile>> {
  const deadline = Date.now() + timeoutMs;
  let waitMs = 1000;

  while (Date.now() < deadline) {
    const res = await fetch(`${BASE}/v1beta/${name}`, { headers: headers() });
    if (!res.ok) return { ok: false, error: `The video could not be checked (${res.status}).` };
    const file = (await res.json()) as Record<string, unknown>;
    const state = String(file.state ?? "PROCESSING") as GeminiFile["state"];

    if (state === "ACTIVE") {
      return {
        ok: true,
        value: {
          name: String(file.name ?? name),
          uri: String(file.uri ?? ""),
          mimeType: String(file.mimeType ?? "video/mp4"),
          state,
          sizeBytes: Number(file.sizeBytes ?? 0) || undefined,
        },
      };
    }
    if (state === "FAILED") {
      return { ok: false, error: "The video could not be processed. Try a different file or format." };
    }

    await new Promise((r) => setTimeout(r, waitMs));
    waitMs = Math.min(waitMs * 1.5, 6000);
  }
  return { ok: false, error: "The video is still being processed. Try the analysis again shortly." };
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

export interface GeminiUsage {
  input: number;
  /**
   * Visible output PLUS thinking.
   *
   * `gemini-3.6-flash` is a reasoning model: it spends tokens thinking before
   * it answers, those tokens are billed as output, and they arrive in
   * `thoughtsTokenCount` — which is NOT included in `candidatesTokenCount`.
   * Recording only the visible count under-reports the bill by roughly 2x,
   * measured, and under-reporting is the dangerous direction: the global spend
   * ceiling reads this number.
   */
  output: number;
  /** The thinking share, kept separately so the split stays visible. */
  thoughts: number;
}

export interface VideoPart {
  /**
   * A Files API uri (studio), a YouTube watch URL (both backends), or
   * empty when the video travels as `inlineBase64` (vertex uploads).
   */
  fileUri: string;
  mimeType: string;
  /** The video bytes themselves, base64 — the vertex upload lane. */
  inlineBase64?: string;
  /** Whole seconds. Omit to read the entire video. */
  startSeconds?: number;
  endSeconds?: number;
}

export interface GenerateInput {
  system: string;
  prompt: string;
  video: VideoPart;
  /** OpenAPI-subset schema. Note: no `additionalProperties` — it is rejected. */
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Which model reads it. Defaults to VIDEO_MODEL; deep reads pass DEEP_VIDEO_MODEL. */
  model?: string;
}

export interface GenerateResult<T> {
  data: T;
  usage: GeminiUsage;
  model: string;
  /** True when the range had to be dropped and stated in the prompt instead. */
  rangeInPromptOnly: boolean;
}

function buildBody(input: GenerateInput, withRange: boolean): Record<string, unknown> {
  const part: Record<string, unknown> = input.video.inlineBase64
    ? { inlineData: { mimeType: input.video.mimeType, data: input.video.inlineBase64 } }
    : { fileData: { fileUri: input.video.fileUri, mimeType: input.video.mimeType } };
  if (withRange && input.video.startSeconds !== undefined && input.video.endSeconds !== undefined) {
    part.videoMetadata = {
      startOffset: `${Math.floor(input.video.startSeconds)}s`,
      endOffset: `${Math.ceil(input.video.endSeconds)}s`,
    };
  }
  return {
    systemInstruction: { parts: [{ text: input.system }] },
    // The video goes first: the documented best practice is one video per
    // request with the text after it.
    contents: [{ role: "user", parts: [part, { text: input.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: input.schema,
      // Measured on a six-observation read: ~1000 tokens of thinking and ~600
      // visible. Thinking is charged against THIS ceiling, so a budget sized
      // for the answer alone returns finishReason MAX_TOKENS with empty
      // content — a film read that silently never arrives. Sized with room.
      maxOutputTokens: input.maxTokens ?? 6000,
      temperature: 0.3,
    },
  };
}

/**
 * One generateContent call against a video.
 *
 * `videoMetadata` is how a request asks for a slice of a longer video rather
 * than the whole thing, and it is the difference between reading 60 seconds and
 * reading 90 minutes. It is sent first; if the API rejects the field, the call
 * is retried once without it and the range is stated in the prompt in MM:SS
 * instead — which the model handles, just less cheaply. The result reports
 * which path it took, so a degraded read is never presented as a clean one.
 */
export async function generateFromVideo<T>(input: GenerateInput): Promise<GeminiOutcome<GenerateResult<T>>> {
  const model = input.model ?? VIDEO_MODEL;
  const endpoint = generateContentEndpoint(model);
  if (!endpoint) return { ok: false, error: "Video model is not configured." };

  const attempt = async (withRange: boolean) =>
    fetch(endpoint, {
      method: "POST",
      headers: generateContentHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(buildBody(input, withRange)),
    });

  let rangeInPromptOnly = false;
  let res = await attempt(true);

  if (res.status === 400) {
    const text = await res.text();
    if (/videoMetadata|video_metadata|startOffset|start_offset|Unknown name/i.test(text)) {
      rangeInPromptOnly = true;
      res = await attempt(false);
    } else {
      return { ok: false, error: `The video read was rejected: ${text.slice(0, 300)}` };
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    /*
      Measured on the vertex backend (2026-08-30): an UNLISTED YouTube
      video returns 403 "Video <id> is not owned by the user", while
      public videos read fine. The raw message reads like the player
      did something wrong; the truth is a backend rule, so say the
      rule and the two things that actually work.
    */
    if (res.status === 403 && /not owned by the user/i.test(text)) {
      return {
        ok: false,
        error:
          "This YouTube video is unlisted, and MIDO's video reader can only read public YouTube videos. It can still play and clip here — to have MIDO read the football, make the video public, or upload a short clip directly. Nothing was charged against your allowance.",
      };
    }
    if (res.status === 503) {
      // Seen in practice: the model reports high demand and refuses. Nothing
      // to do with the clip, and worth saying so rather than showing a raw
      // upstream error to someone who just wanted their film read.
      return {
        ok: false,
        error:
          "The video model is busy right now and refused the request. Nothing was charged against your allowance — try again in a minute.",
      };
    }
    if (res.status === 429) {
      /*
        Worth quoting the provider rather than guessing. The free tier caps
        generateContent requests per window, and its 429 carries a real
        `retryDelay` and says which quota was hit — "retry in a minute" is a
        guess that is wrong whenever the cap is a daily one.
      */
      let text = "";
      try {
        text = await res.text();
      } catch {
        /* the status is the message */
      }
      const seconds = text.match(/retry in ([\d.]+)s/i)?.[1];
      const daily = /per day|PerDay|free_tier_requests/i.test(text);
      return {
        ok: false,
        error: daily
          ? "The video model's request quota for this project is used up. Nothing was charged against your allowance."
          : `The video model is rate limited right now${seconds ? ` — try again in about ${Math.ceil(Number(seconds))}s` : ""}. Nothing was charged against your allowance.`,
      };
    }
    return { ok: false, error: `The video read failed (${res.status}). ${text.slice(0, 200)}` };
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
    };
  };

  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) {
    return {
      ok: false,
      error:
        candidate?.finishReason === "MAX_TOKENS"
          ? "The read used its whole token budget before producing an answer. This is a limit on MIDO's side, not on your clip."
          : "The video read came back empty.",
    };
  }

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    return { ok: false, error: "The video read came back in a shape that could not be used." };
  }

  return {
    ok: true,
    value: {
      data,
      usage: {
        input: json.usageMetadata?.promptTokenCount ?? 0,
        // Thinking is billed as output. Sum it, or the meter lies.
        output:
          (json.usageMetadata?.candidatesTokenCount ?? 0) +
          (json.usageMetadata?.thoughtsTokenCount ?? 0),
        thoughts: json.usageMetadata?.thoughtsTokenCount ?? 0,
      },
      model,
      rangeInPromptOnly,
    },
  };
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const YOUTUBE = /^https?:\/\/(www\.|m\.)?(youtube\.com\/watch\?|youtu\.be\/|youtube\.com\/shorts\/)/i;

/** YouTube URLs are passed straight through — no upload, no size ceiling. */
export function isYouTube(url: string): boolean {
  return YOUTUBE.test(url.trim());
}
