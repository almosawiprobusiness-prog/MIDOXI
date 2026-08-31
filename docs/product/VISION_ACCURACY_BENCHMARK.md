# MIDO Vision — accuracy benchmark (2026-08-30)

One variable at a time, same four frame-verified passages, production prompt
and endpoint. Raw outputs with token counts and latency are archived in
`scratch-vision/results-v1/` (prompt v1) and `scratch-vision/results/`
(prompt v2 confirmation runs). Scoring rubric 0–5 (0 wrong · 3 usable · 5
highly accurate), scored against frame-level ground truth; FALSE ATTR counts
confident wrong-player/second-person claims; UNSUP counts specifics no frame
supports.

## Passages

- **p1** build-up + pressing (blue #10 vs white, dusk; contains a scene cut —
  several configs detected it, which the initial ground truth had missed)
- **p2** direct free kick (navy wall, white takes; outcome settled by
  cross-model consensus + scoreboard as a goal)
- **p3** GOLDEN TEST — identity says "royal blue #10" but the only blue
  shirt on the pitch is the REFEREE. Correct answer: abstain.
- **p4** close-range finish — ball visibly enters the net. "Saved"/"missed"
  = wrong.

## Prompt v1 matrix (4 passages per config)

| CONFIG | PLAYER ID | ACTION | OFF-BALL | FALSE ATTR | UNSUP | LATENCY avg | IN-TOK avg | COST/read* |
|---|---|---|---|---|---|---|---|---|
| A 2.5-flash · yt · no id | 3.0 | 2.8 | 3.0 | 0 | 3 | 13.8s | 4,856 | $0.007 |
| B 2.5-flash · yt · id | 3.5 | 2.8 | 3.0 | 1 | 3 | 11.7s | 4,847 | $0.007 |
| C = B + MEDIUM res | 3.5 | 3.0 | 3.0 | 0 | 2 | 9.9s | 4,847 (identical) | $0.007 |
| D 2.5-pro · yt · id | 4.5 | 4.0 | 4.0 | 1 | 1 | 27.3s | 4,847 | $0.030 |
| E 3.7-flash · yt · id | 4.0 | 3.8 | 3.5 | **0** | 1 | 11.3s | 2,402 | $0.005 |
| F 2.5-flash · file · id | 1.0 | 3.0 | 3.0 | **6** | 3 | 20.6s | 4,555 | $0.007 |
| G 2.5-pro · file · id | 1.5 | 3.3 | 3.5 | **5** | 2 | 25.7s | 4,555 | $0.030 |
| H 3.7-flash · file · id | 4.0 | 3.5 | 3.0 | **0** | 2 | 14.8s | 2,061 | $0.005 |

\* current price list: 3.7-flash $0.75/$3.75, 2.5-flash $0.30/$2.50,
2.5-pro $1.25/$10 per Mtok; ~15s passages. A 60–90s window costs roughly
2–4× the input side.

**What the matrix says:**

1. **The model matters more than the source.** 3.7-flash: zero false
   attributions in eight runs, both lanes. The 2.5 family on the UPLOAD lane
   confidently coached the referee ("You receive the ball in the center
   circle…") — catastrophic, reproducible on flash AND pro.
2. **Goal recognition** (p4): D, E, F, H said goal (correct — H even said
   "dips under the crossbar", exactly what frame f163 shows); A, B, G
   invented a crossbar/post + clearance.
3. **2.5-pro is the sharpest describer** — the only config to name the
   referee trap unprompted, and the p4 blindside-run read matched the frames
   — but v1-pro also placed the viewer in the opposition's wall on p2.
4. **Media resolution is a dead knob for video**: HIGH rejected, MEDIUM
   token-identical to default. Closed by measurement.
5. **YouTube vs upload is NOT the story at 720p.** Token counts are near
   identical; accuracy differences track the model, not the source. (Caveat:
   the source file is itself a 720p YouTube-derived encode; a pristine 1080p+
   original may still read better — untested here, said honestly.)
6. **gemini-3.7-flash reads YouTube through Vertex** — the 3.6-flash 500 is
   gone in 3.7. The broken code default is fixed by measurement, not hope.

## Prompt v2 confirmation runs

Prompt v2 adds: scene-first kit audit (referee is never the viewer), no
second-person prose when basis is none, no identity across scene cuts,
outcome discipline (an invented save is as wrong as an invented goal),
scanning restraint, viewer-first narration. Reruns of every failing case:

| Case | v1 | v2 |
|---|---|---|
| F-p3 (flash·file, referee trap) | 4 confident "viewer" claims | "stated kit matches the referee… not possible to identify" — abstains, 0 claims |
| G-p3 (pro·file, referee trap) | "You receive… layoff" | "only player in that colour is the goalkeeper… no outfield player matches" — abstains |
| D-p2 (pro·yt, wall error) | put viewer in the OPPOSITION wall | "numbers not legible, no specific player identified" — abstains, describes the set piece |
| D-p3 / E-p3 | implicit abstention | EXPLICIT abstention naming the official's shirt |
| D-p4 / E-p4 | goal ✓ | goal ✓, attribution kept (kit-unique) |

**False attributions after prompt v2: 0 across all nine confirmation runs,
with correct attribution retained where the kit is genuinely unique.**

## Verdict

- **BEST QUALITY:** gemini-2.5-pro + prompt v2 (either lane).
- **BEST VALUE:** gemini-3.7-flash + prompt v2 — top-tier honesty, ~½ the
  tokens of 2.5-flash, $0.005/passage, and it fixes the YouTube-on-Vertex 500.
- **BEST PRODUCTION ROUTING:** Quick read = 3.7-flash; Deep read =
  2.5-pro (2 film reads, honest fallback to quick); identity ceiling and the
  new identity-level surface on both. Implemented exactly so.
