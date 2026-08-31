# MIDO Vision — accuracy baseline (2026-08-30)

The measured starting point for the accuracy pass, before anything changed.
Harness: `scripts/vision-bench.mjs` (production prompt + schema lifted from
`native-video.ts`, production Vertex endpoint). Footage: the owner's own
2021 highlight reel (720p30, elevated touchline camera, night + day clips —
honest amateur conditions). Ground truth: frame-level inspection recorded in
`scratch-vision/ground-truth.md`; four passages covering build-up/pressing,
a set piece, an identity trap, and a close-range finish.

## Production configuration at baseline

| | |
|---|---|
| Backend | Vertex AI, project-bound, location `global` |
| Model | `gemini-2.5-flash` (env pin; the CODE default was `gemini-3.6-flash`, which 500s on YouTube via Vertex — a fresh deploy without the pin was broken) |
| Media resolution | none sent (provider default) |
| Prompt | video_read v1 |
| Identity | free-text `pitch_identity` only, unset for most players |
| Frames lane | Claude sonnet, no identity passed, no confidence field — every frame read rendered "Observed" |
| Routing | one model for every read; no deep option; no reuse/idempotency; identification audit computed then discarded |

## Baseline results (config A/B, prompt v1)

- **Football facts:** usable but blunt. On the goal-mouth passage the ball
  visibly enters the net (frames f163/f165); 2.5-flash reported "hits the
  crossbar… header misses" (no identity) and "hits the crossbar… cleared"
  (with identity). Two runs, two invented outcomes.
- **Identity:** with identity given, 2.5-flash on YouTube abstained correctly
  on the trap passage. On DIRECT UPLOAD both 2.5 models confidently narrated
  the blue-shirted REFEREE as the viewer ("You receive the ball in the center
  circle…") — four second-person claims about a player who does not exist.
  This is the worst failure the feature can produce, and it was reproducible.
- **Overclaimed audits:** `squadNumberLegible: true` claimed on footage where
  no number is legible (A-p4, B-p2, F-p2/p4) — the audit needed code-side
  distrust, which existed for the ceiling but was then thrown away.
- **Latency:** 9.7–21s per passage (2.5-flash). **Tokens:** ~4,900 in / ~1,900
  charged out per ~15s passage.
- **Resolution knob:** `MEDIA_RESOLUTION_HIGH` is rejected for video
  ("supports HIGH media resolution only for single images");
  `MEDIA_RESOLUTION_MEDIUM` produced byte-identical input token counts to
  the default — the knob does nothing for video on these models. Measured,
  closed.

## Known bottlenecks confirmed by the audit

1. Broken code-default model (`gemini-3.6-flash`) held off only by an env var.
2. Identification audit (basis / couldMatchOthers / legibility) discarded
   after deriving the ceiling — nothing stored, nothing shown as a signal.
3. Frames lane ignored identity entirely and emitted no confidence.
4. No depth routing, no reuse, no analysis versioning (prompt_version unwritten),
   no correction path ("that's not me" impossible).
5. Free-text identity only; no structure, no per-match override.

Research date 2026-08-30. Sources: Vertex/Gemini docs (video understanding,
media-resolution, model list) via ai.google.dev and docs.cloud.google.com;
model availability verified live against this project's Vertex endpoint
(`vision-bench.mjs probe`): 2.5-flash/pro, 3.5/3.6/3.7-flash answer; no 3.x
Pro is served to this project.
