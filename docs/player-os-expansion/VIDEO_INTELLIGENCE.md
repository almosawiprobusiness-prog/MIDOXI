# Video intelligence — feasibility and spec

Researched 2026-08-22 against current model documentation and published
sports-CV work. Costs are computed, not estimated.

## The finding that changes the architecture

**Frontier models now ingest video natively.** Gemini samples at 1 fps, accepts
up to 1 hour at default resolution or 3 hours at low resolution, answers
questions about specific timestamps in `MM:SS`, and reasons across time. Files up
to 20 GB via the File API.

MIDO's current approach — capture 12 JPEGs in the browser, send them as images —
was the right call when it was built. It is now the wrong one. It cannot see
motion, and motion is most of football.

## Cost, computed

Low resolution = 100 tokens/second of video. Output ≈ 1,500 tokens for a written
analysis.

| input | tokens | Flash-Lite | Flash | Pro |
|---|---:|---:|---:|---:|
| 30s clip | 3,000 | **$0.0009** | $0.0079 | $0.0390 |
| 5-min highlight | 30,000 | **$0.0036** | $0.0281 | $0.1470 |
| 20-min training | 120,000 | **$0.0126** | $0.0956 | $0.5070 |
| 90-min match | 540,000 | **$0.0546** | $0.4106 | $2.1870 |

**A full match read costs about five cents.** Default resolution is 3× that.

### But inference is no longer the expensive part

A 90-minute 1080p match is ~4.5 GB.

```
storage            $0.095 / month
egress per view    $0.405
ten views          $4.05
AI read            $0.055
```

**Bandwidth costs roughly eight times the analysis.** Every instinct that says
"AI is the expensive bit" is now wrong, and the pricing model must follow the
real cost curve:

- Analysis can be generous.
- **Storage duration and playback are what need limits.**
- Transcode to 720p for playback (~1.2 GB), keep the original only if the player
  asks. Serve through a CDN with range requests.

## What is actually feasible

### Feasible now
- **Describing what is visible**, with timestamps, across a whole clip
- **Temporal reasoning** — "he checks his shoulder *before* receiving" is now
  answerable in a way stills never allowed
- Body shape, orientation, movement direction, first-touch direction
- Relative positioning ("between the lines", "on the last shoulder")
- Pattern recognition across repeated events in one video

### Not feasible without a tracking vendor
- Any **measurement**: distance, speed, sprint counts, xG, possession %
- Pitch coordinates without homography
- Anything requiring a calibrated camera

### The real blocker — *which player is you*

This, not cost, is what limits the product. Published work is consistent:
jersey numbers are unreadable in most frames of amateur footage due to motion
blur, resolution, occlusion and single-angle capture. Player re-identification
in broadcast video is still an open research problem; amateur video is worse.

Three mitigations, in order of reliability:

1. **The player tells us.** "I'm number 9, blue kit, playing centre-forward."
   Passed in the prompt, this works well in practice and costs nothing.
2. **The player marks themselves once.** Tap yourself in a frame at the start;
   pass that crop as a reference image alongside the video.
3. **Short, self-selected clips.** In a 30-second clip the player chose, they are
   almost always the subject. This is why clips should be the V1 unit, not
   matches.

**Honest position:** on a full match with no hints, MIDO cannot reliably say
which player is you, and must not pretend to. Every observation carries the
confidence marker the product already uses.

## Confidence model

The existing three-way model extends naturally:

| marker | meaning | example |
|---|---|---|
| `observed` | directly visible in the video | "receives with the right foot facing own goal" |
| `inferred` | reasonable reading of what is visible | "the touch suggests he had not scanned" |
| `uncertain` | flagged but not asserted | "possibly a shoulder check at 3:12 — the camera turns away" |

Rule, inherited from `TRACKING_GAP`: **frame reading is interpretation, never
measurement.** No observation may contain a distance, a speed, or a count of
something off-camera.

## Pipeline

```
upload (resumable, direct to storage)
   ↓
transcode → 720p playback copy + keep/discard original
   ↓
[clip]  → straight to the model                    ← V1
[long]  → segment → analyse segments → synthesise  ← V2
   ↓
player-identity hint  (number + kit + position, or a marked frame)
   ↓
model call: focus + viewer context + knowledge-graph concepts
   ↓
timestamped observations, each with a confidence marker
   ↓
map observations → concepts → development goals     ← the actual product
   ↓
persist to clip_analyses, surface in Film Room and on the goal
```

### Version plan

**V1 — clips (30–90s).** Replace frame capture with native video. Player-identity
hint in the prompt. One model call. Costs under a cent. This is a small change to
`lib/video/provider.ts` and `frame-reader.ts`, and it is most of the value.

**V2 — highlights and training (2–20 min).** Needs a job queue and a transcode
step. Segment, analyse, synthesise. Still cheap.

**V3 — full match.** Only worth it once V1 observations are demonstrably good.
Segment into passages of play; analyse only segments the player is likely in.

**Not planned — tracking.** Integrate a vendor (Veo, Trace) if measurement is
ever needed. Building homography and re-identification is a company, not a
feature.

## What we do not build

Open-source football CV is mature — YOLO + ByteTrack pipelines with homography
and speed estimation are widely published. They also need a GPU, a training set
for your camera angles, and constant maintenance, and they still do not solve
re-identification on amateur footage. **Integrate or skip.**

## Infrastructure needed

| piece | why | note |
|---|---|---|
| Job queue | video work exceeds a request | **the single biggest gap** — nothing async exists today |
| Transcode | 4.5 GB → 1.2 GB playback | ffmpeg in a worker, or a transcoding service |
| Resumable upload | phone uploads on stadium wifi fail | tus or storage-native resumable |
| CDN + range requests | seeking a 90-min video | egress is the dominant cost |
| Retry + dead-letter | model calls fail | analysis must be resumable, never silently lost |

## Privacy

Match video contains minors. Non-negotiable, and it is a product constraint
before it is a legal one:

- Video is private by default; sharing is explicit and per-artefact
- No third-party processing without stating which provider and what it receives
- Deletion must remove derived analyses and cached frames, not only the file
- Under-16 accounts: no public sharing, no video in shared reports without
  guardian consent

---

## Measured, on real footage (22 Aug 2026)

Everything above was research. This is what the shipping pipeline actually did
against a Sunday-league match on YouTube — wide touchline camera, the hard case.

| | 45s clip | 90s clip |
|---|--:|--:|
| Video input tokens | 4,614 | 8,867 |
| Tokens per second of film | 103 | **99** |
| Thinking tokens | 1,210–2,067 | 1,387 |
| Visible output | 310–349 | 505 |
| Latency | 16–25s | **43s** |
| Observations returned | 3 | 4, spread across the full window |

**99 tokens per second of video** matches the published low-resolution figure
almost exactly, which means the cost model in this document holds: a 90-minute
match is ~535k input tokens, still cents.

**Latency scales with clip length and is the real ceiling on UX**, not cost.
43 seconds for a 90-second clip is a long time to watch a spinner. Anything
approaching full-match length needs a job queue and a notification, exactly as
argued above — this is now measured rather than assumed.

### The free tier is 20 requests per day

Not per minute. Confirmed by waiting the quota out: the 429 carries a
`retryDelay` of ~37s that never actually clears, and the metric named is
`generate_content_free_tier_requests, limit: 20`.

Twenty film reads per day **across every user of the deployment**, not per user.
That is a demo allowance, not a product. Enabling billing on the Google Cloud
project behind the key lifts it; at Flash rates the reads themselves cost
fractions of a cent, so the free-tier cap is the only thing in the way.

Until billing is on, MIDO refunds the player's allowance and says the quota is
used up rather than blaming their clip.

### What was not tested

A 300-second read. The day's quota was exhausted proving the point above. The
90-second ceiling in `provider.ts` is therefore still a product judgement rather
than a measured limit.

### The 90-second ceiling, now measured

Run once billing was on, so the quota no longer blocked it. Same match, same
prompt, three window lengths:

| Window | Video tokens | Observations | One per | Output each | Latency |
|--:|--:|--:|--:|--:|--:|
| 45s | 4,614 | 3 | **15s of film** | 116 tok | ~20s |
| 90s | 8,867 | 4 | **22s of film** | 103 tok | 31s |
| 300s | 27,977 | 3 | **100s of film** | 75 tok | 44s |

Five minutes of film produced FEWER observations than ninety seconds, and
shorter ones. Density fell about 4.5×, and the bodies thinned from 116 output
tokens to 75.

That is the whole argument for the ceiling, and it is no longer a hunch: more
film does not buy more insight, it buys a thinner summary. A read of five
minutes tells a player roughly what happened; a read of forty-five seconds tells
them what to do differently. The `CLIP_MAX_SECONDS = 90` in `provider.ts` is a
product decision that the numbers support, and the sweet spot is nearer the
floor than the ceiling.

Cost is not the lever either. Because output — mostly thinking — dominates the
bill and stays roughly constant, a 30s read costs $0.0057 and a 90s read
$0.0074. Shortening a clip saves latency, not money.

Two other things seen on these runs:

· `couldMatchOthers` came back as 10 on one window and 2 on another, for the
  same footage. The confidence ceiling deliberately keys off `basis`, which was
  `kit-and-role` on every single run, so the noise in that count does not reach
  the player. Worth remembering if anything is ever built on the number itself.

· A 503 "high demand" refusal happened once in six calls. It is handled like a
  rate limit: the allowance is refunded and the message says to try again.
