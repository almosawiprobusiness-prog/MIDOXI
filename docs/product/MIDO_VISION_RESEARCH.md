# MIDO VISION — provider research, 2026

**Research date: 2026-08-30** (all sources accessed that day, primary vendor
pages unless flagged). This refreshes and extends
`docs/player-os-expansion/VIDEO_INTELLIGENCE.md` (researched 2026-08-22,
measured on real footage the same week). Facts that could not be confirmed
from a primary source are marked **[unconfirmed]**.

The question this answers: what should power genuine video understanding in
the Film Room — at clip scale now and match scale later — given accuracy,
football usefulness, cost, privacy, latency and solo-founder maintainability.

---

## 1. Google Gemini — the only true native-video LLM API

Sources: ai.google.dev/gemini-api/docs/video-understanding · /docs/pricing ·
/docs/files · /terms · /docs/structured-output

- Native video: the model watches frames **and hears audio** in one call.
  1 fps default sampling; audio at 1 Kbps mono, timestamped every second.
  MM:SS timestamp referencing is a documented first-class convention.
- Length: ~1 hour at default media resolution, ~3 hours at low resolution on
  1M-context models. A 90-minute match fits one call **only at low res**
  (~540k tokens).
- Token math: default res ≈ 300 tokens/sec of video; low res ≈ 100 tokens/sec
  — which MIDO measured independently at 99 tokens/sec on real Sunday-league
  footage (VIDEO_INTELLIGENCE.md), so the published figure is trustworthy.
- Structured output: JSON-Schema-constrained generation (OpenAPI subset —
  the dialect `lib/video/gemini.ts` already speaks).
- Files API: 2GB/file, 20GB/project, free, **48h retention** — scratch
  staging, not storage. MIDO already uses it (`uploadFromUrl`, `FILE_TTL_HOURS
  = 47`).

**Pricing** (per 1M tokens): 2.5 Flash $0.30 in / $2.50 out · 2.5 Flash-Lite
$0.10/$0.40 · 2.5 Pro $1.25/$10 (≤200k prompt) · 3.1 Pro Preview $2/$12.
Newer 3.x Flash names/prices seen on the page (3.6/3.7-flash at $0.75/$3.75
promo to Dec 2026) — **[verify by eyeball before relying]**; MIDO's deployed
`GEMINI_VIDEO_MODEL` default is `gemini-3.6-flash`. **Batch API: −50%.**

Derived cost per analyzed minute of video (input side):

| model / res | $/video-minute |
|---|---:|
| 2.5 Flash, low res | **$0.0018** |
| 2.5 Flash, default res | $0.0054 |
| 3.1 Pro Preview, default | $0.036 |

A full 90-minute match at low res on Flash ≈ **$0.16 input** (+ pennies of
output); ~$0.08 via Batch. Output (mostly thinking) dominates short-clip
bills — measured: a 30s read $0.0057, a 90s read $0.0074.

**Privacy / compliance — the load-bearing findings:**

1. **Paid tier only.** The unpaid tier trains on your data; the paid tier
   does not ("Google doesn't use your prompts or responses to improve our
   products"). MIDO's key has billing enabled — keep it that way.
2. **⚠️ The consumer Gemini API terms bar use in a service "directed towards
   or likely to be accessed by individuals under the age of 18."** A youth
   football development product plausibly trips this clause. The likely
   resolution is consuming Gemini through **Vertex AI** (enterprise terms +
   DPA) instead of an AI Studio key. This is the single most important
   compliance item in this research and is an **owner action** — it needs the
   actual Vertex terms read (or Google asked) before Vision goes further than
   it already has.

Latency class: upload + file-ACTIVE poll (seconds–minutes) + generation
(tens of seconds). Measured: 45s clip ≈ 20s, 90s clip ≈ 31–43s. Anything
longer than a clip needs the job to survive the request.

## 2. Anthropic Claude — frames only; the report-writer, not the eyes

Sources: platform.claude.com/docs/en/build-with-claude/vision · DPA/support.

- **No video input in 2026.** Frames-as-images only (MIDO's existing
  `frameReader` path); no audio. Up to 600 images/request (100 on 200k
  context), 10MB/image, 32MB/request.
- ~448 tokens per 768×432 frame → at 1 frame/2s ≈ 13.4k tokens/min: Haiku
  ~$0.013/min, Opus ~$0.067/min. Costs more per minute than Gemini watching
  the actual video, and is blind to motion between frames.
- Structured output: **best in class** — GA `output_config` JSON-schema
  guaranteed outputs (MIDO's `generateJson` already rides this).
- Privacy: API data not used for training (DPA); images ephemeral.
- Verdict: keep exactly where it is — frame reading as the no-Gemini
  fallback, and **the reasoning/composition layer over observation rows**
  (development connections, reports), where it never touches the footage.

## 3. OpenAI — no native video input as of Aug 2026

Frames-only like Claude (official cookbook still says extract frames with
ffmpeg); Sora is generation, not understanding. No capability MIDO lacks
elsewhere; a third vendor for zero new capability. **Skip.**

## 4. TwelveLabs — purpose-built video search/understanding

Sources: twelvelabs.io/pricing · docs.twelvelabs.io/docs/concepts/models.

- Marengo (index/search): 4s–4h, ≤4GB per video, $0.042/min to index,
  $4/1k searches. Pegasus (video-to-text): 4s–1h, $0.0292/min analyzed.
- A 90-min match: $3.78 to index + $2.63 per full analysis — **20–40× Gemini
  Flash per analyzed minute**, in exchange for a persistent semantic index
  ("find every press-break this season") Gemini cannot replicate without
  re-inference per query.
- Structured-output rigor and video-data training terms **[unconfirmed]** —
  read the ToS/DPA before any minors' footage goes there.
- Verdict: **defer.** A second vendor and an async index lifecycle for a
  search feature nobody has asked for yet. Revisit if "search my season"
  becomes a paid-tier promise.

## 5. Private video infrastructure

| | Supabase Storage (today) | Mux | Cloudflare Stream |
|---|---|---|---|
| Max file | 50MB free plan (**the current wall**) / up to 500GB on Pro | — | 30GB/file |
| Storage | $0.0213/GB-mo after 100GB (Pro) | $0.0024/min-mo @720p | $5/1k min-mo |
| Delivery | **$0.09/GB egress** after 250GB | $0.0008/min (100k min/mo free) | $1/1k min |
| Transcode | **none** | free, automatic HLS | free, automatic HLS |
| Signed access | signed URLs + TUS resumable | signed URLs free | signed JWTs, ≤24h |

The trap in the current stack is not size but **egress + no transcoding**: a
90-min 1080p phone video is 3–6GB raw; every full playback ≈ $0.27–0.54 and
buffers as raw MP4. Per-minute delivery (Mux/Stream) beats per-GB egress
~5× for match video and hands back HLS.

Sequence that follows the cost curve:
1. **Now (clips ≤50MB):** stay on Supabase Storage — TUS-capable, signed,
   already enforced end-to-end (`verify-storage.mjs`).
2. **When the plan upgrades to Pro:** raise the upload ceiling deliberately
   (a product decision recorded in `film-types.ts`, not a constant bump).
3. **When full matches arrive as uploads:** Supabase stays ingest + system
   of record; playback moves to Mux or Stream (config, not architecture —
   `videos.storage_path` already abstracts the location). Unlisted YouTube
   remains the zero-cost match path meanwhile (`LONG_FOOTAGE_ADVICE`).

## 6. Decision

**Gemini stays the eyes. Claude stays the reasoner. Nothing new is
integrated this phase.**

- Clip analysis (V1, shipped): Gemini native video, JSON-schema output,
  identity ceiling in code. Unchanged.
- Multi-window analysis (this phase): same provider, N ≤90s windows chosen
  deliberately, each window a separate grounded read; synthesis across
  windows happens over the *observation rows*, not the footage — that layer
  is Claude's, and it must speak in provenance ("across 3 analyzed
  passages…"), never "I watched the match."
- Full-match single-call (low res, Batch): architecture supports it later;
  **not built now** — observation density measurably collapses on long
  windows (3 observations per 300s vs 3 per 45s), so match-scale value comes
  from *many chosen windows*, not one long read.
- OpenAI: no. TwelveLabs: deferred, criteria above.

## Owner actions raised by this research

1. **Gemini minors clause** — ~~decide AI Studio key vs Vertex~~
   **RESOLVED 2026-08-30: production migrated to Vertex AI (Gemini
   Enterprise Agent Platform)** — enterprise terms, same billed
   project, same models. Executed setup + rollback path in
   MIDO_VISION_ARCHITECTURE.md.
2. Supabase Pro upgrade decision when clip volume warrants (>50MB uploads).
3. ~~Open retest: unlisted YouTube~~ **TESTED 2026-08-30 on the
   owner's real channel videos.** Measured matrix: Vertex refuses
   unlisted (403 "Video … is not owned by the user") and reads public
   perfectly; the consumer API still reads unlisted (its own docs
   notwithstanding). Product copy updated (`LONG_FOOTAGE_ADVICE`
   splits play-and-clip from AI-read), and the 403 is mapped to honest
   player copy in `lib/video/gemini.ts`. Also noted:
   `gemini-2.5-flash` is refused to NEW users on the consumer API —
   the rollback path would need `GEMINI_VIDEO_MODEL` reconsidered if
   ever used.
