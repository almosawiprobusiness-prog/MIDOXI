# AI cost model — 2026-08-30

Provider prices from primary sources on 2026-08-30 (see
`MIDO_VISION_RESEARCH.md` for URLs). Internal accounting uses
`lib/ai/pricing.ts`'s deliberately-biased-high blended rates; this
document estimates REAL cost so margin can be reasoned about. Every
figure below is an estimate and labelled with its assumptions.

## Per-operation real-cost estimates

| Operation | Provider / tier | Assumption | Est. real cost |
|---|---|---|---:|
| Session draft | Sonnet (standard) | ~3k in / ~1.2k out | ~$0.015 |
| Session adaptation | Sonnet | ~3.5k in / ~1.2k out | ~$0.017 |
| Study enhancement | Sonnet, cached system | ~4k in / ~2k out | ~$0.03 (first) / ~$0.02 (cached) |
| Study picks (2-call) | Haiku + Sonnet | measured pattern | ~$0.02 |
| Frame read (12 stills) | Sonnet + images | ~6k in / ~1.5k out | ~$0.03 |
| **Video window read** | Gemini 3.6-flash | **measured**: 30s $0.0057 · 90s $0.0074 | ~$0.006–0.008 |
| Vision job (4 windows) | Gemini | 4 × window | ~$0.03 |
| Voice match log | Gemini | ~8MB audio, 4k out | ~$0.01 |
| Match focus / patterns | none | pure arithmetic + curated cues | $0.00 |
| NBA / recommendations | none | deterministic | $0.00 |
| Publish card render | none | ImageResponse compute | ~$0.00 |
| Report / session PDF | none | browser print | $0.00 |

The intelligence layer's shape keeps most of the loop at zero marginal
cost: the scorer, patterns, match focus, publish and documents are all
deterministic. Money is spent only on generation and vision — the two
places a model genuinely adds something — and both are metered.

## Player-month scenarios (real cost)

| Scenario | Assumed usage | Est. cost / month |
|---|---|---:|
| **Normal player** | 8 session drafts + 4 adaptations + 6 study ops + 8 video windows + 6 voice logs | **~$0.45** |
| **Heavy player** | 25 drafts + 15 adaptations + 20 study ops + 20 windows + 20 voice logs + 10 frame reads | **~$1.60** |
| **Vision-heavy** | Player allowance ceiling: 20 deep_analyses as 4-window jobs (80 windows exceeds allowance — capped at 20 windows) + heavy text | **~$1.20** |

Allowances cap the tail: `player` = 150 ai_interactions / 20
deep_analyses / 30 study_discoveries per month. Worst-case fully-spent
allowances at real rates ≈ 150×$0.017 + 20×$0.03 + 30×$0.03 ≈
**$4.05/month** against $9.99 revenue → worst-case gross margin ≈ 59%
before infrastructure; typical usage is far below the ceiling.

## Internal accounting vs. this model

`TIER_COST_PER_MTOK` (fast 3 / standard 9 / deep 15 / video 1 $/Mtok
blended) is intentionally ABOVE the measured blend, because the global
ceiling (`AI_MONTHLY_BUDGET_USD`) reads it, and under-counting spends
past the cap. Consequence: the admin spend figure over-reports real
cost by roughly 1.3–2×. That is a feature of the kill-switch, not an
error, and this document is where the real number lives.

Attribution: as of this phase every Claude call records its `model` in
`ai_usage_events`, so a month's spend can be split by model version
after a `MODELS` table change.

## Cost controls in force

1. Entitlement gate → global budget gate → consume-before-work, on
   every metered path.
2. Platform kill-switch: `AI_MONTHLY_BUDGET_USD` crossing switches AI
   off product-wide; deterministic paths keep working.
3. Vision jobs: ≤6 windows/job, window = one metered read, idempotent
   creation (double-tap cannot pay twice), 2-attempt retry cap.
4. Refund discipline: model-failure refunds, useless-answer non-refunds
   (documented in `meter.ts`).
5. Known gap (accepted): budget sum caps at 20k rows/month
   (`budget.ts`) — at ~20k AI events/month this under-reports; revisit
   with an aggregate RPC when volume approaches that.

## What would change this model

- Full-match single-call reads (low-res Batch ≈ $0.08–0.16/match) —
  architecture supports it; not enabled.
- Moving Vision to Vertex AI for the minors-clause resolution may
  change unit prices marginally; re-run this table then.

## Vision, re-measured (2026-08-30 — accuracy pass)

Benchmark-measured (vision-bench, current price list: 3.7-flash $0.75/$3.75,
2.5-pro $1.25/$10 per Mtok):

| Operation | Tokens (typical) | Cost | Latency |
|---|---|---|---|
| Quick read, ~15s passage (3.7-flash) | ~2.4k in / ~0.9k out | **$0.005** | 8–20s |
| Quick read, 60–90s window | ~8k in / ~1k out | **~$0.010** | 15–30s |
| Deep read, ~15s passage (2.5-pro) | ~5.1k in / ~2.3k out | **$0.030** | 24–30s |
| Deep read, 60s window | ~17k in / ~2.5k out | **~$0.046** | 30–45s |
| Direct upload vs YouTube | ≈ same tokens; upload adds transfer latency | — | +3–10s |

Player-months: a normal player (≤20 quick reads) costs **≤ $0.20/mo** of
vision; a vision-heavy player (60 reads, third of them deep) **≈ $1.00/mo**.
Deep read at 2 film-read units keeps the allowance the price lever — no
plan change needed. Internal ladder: `video` logged at $2/Mtok blended,
`video_deep` at $5/Mtok — both deliberately above the measured blends
($1.6 / $4.0) because `withinAiBudget()` reads them.

Tier read: quick reads are cheap enough for broad paid allowance; deep reads
are safely meterable at 2 units; full-match remains future/expensive and is
still refused honestly.
