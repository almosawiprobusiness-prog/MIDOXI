# MIDO AI 2.0 — final audit

Run 2026-08-30, at the end of the intelligence-layer phase
(commits `184785c` → this one). Verdicts are against the phase
directive's release gate.

## Gate results

| Gate | Verdict | Evidence |
|---|---|---|
| AI context grounded | **PASS** | one signal pipeline, citable keys incl. `study:`, `validateBlocks` drops uncited blocks; Zod at the boundary |
| Training generation works | **PASS** | draft + brief + composed fallback; golden test A; browser-verified |
| Study → Training works | **PASS** | Apply-this CTA → `?focus=study:<slug>` → engine builds around it; golden D; browser-verified deep link |
| Training adaptation works | **PASS** | 10 directives; objective preserved by construction; citation-subset + duration-direction contracts; browser-verified (incl. a caught+fixed 3-block gutting) |
| Safety rules work | **PASS** | `adaptGuard` refuses load-raising directives pre-model; scorer safety floor untouched; golden B |
| Vision is truthful | **PASS** | truth table in MIDO_VISION_ARCHITECTURE; identity ceiling in code; no full-match pretense; multi-window synthesis reasons over rows |
| Vision pipeline survives failures | **PASS** | job rows, per-window retry→isolated failure, resumable, idempotent; 17 rule tests; stale-handle recovery wired |
| Film → development actions | **PASS** | existing confirm flow + "MIDO has noticed" cards + file/undo on every observation |
| Film → training actions | **PASS** | train chip on observations & pattern cards → focused brief |
| Publish works | **PASS** | 4 templates × 3 formats, all 12 verified 200 in browser; whitelist adapters |
| PDF works | **PASS** | session-plan document verified in browser; print pipeline = vector PDF |
| Private info does not leak | **PASS** | publish vocabulary cannot express private fields; share tokens/fields regime untouched; film-share NaN fallthrough closed |
| Usage metered | **PASS** | all metered ops ride existing gates; model attribution added to every Claude call; vision windows = deep_analyses units |
| Cost controls exist | **PASS** | budget ceiling, consume-before-work, job idempotency + attempt caps; AI_COST_MODEL.md |
| Mobile | **PASS (spot)** | runner is thumb-height full-screen w/ safe-area; publish preview scales; documents are single-column. Full 375/390/430 sweep remains a standing QA habit, not a one-off |
| Authorization | **PASS** | 0039 RLS owner policy + anon revoked, probe-verified from outside; publish route auth-gated |
| Tests | **PASS** | 808 unit tests green (63 added this phase) |
| Typecheck / lint / build | **PASS** | clean / 0 errors / passes at every phase commit |
| Real browser QA | **PASS** | draft→adapt→accept→run→log; ?focus deep link; publish studio; session document; demo empty-states honest |

## Caught during the phase (by tests or browser QA, fixed)

1. Deterministic "shorter" gutted a 3-block session to warm-up +
   cool-down — caught in the browser, fixed with the ≥2-middle-blocks
   rule, pinned by a test.
2. The runner unmounted the log dialog mid-open — caught in the
   browser, fixed by keeping the runner mounted beneath it.
3. `?focus` auto-open called a server function during SSR — caught by
   the dev-server log, fixed with a mount effect (then a lint rule
   pushed it to a deferred tick).
4. `getTraining` dropped plan blocks the session document needed.
5. A film share token would have rendered a report of NaN dates.

## Open items (not blockers, tracked)

- **Gemini consumer-API minors clause** — owner decision (Vertex);
  the single most important compliance item (research doc).
- Migration 0039 applied + probe-verified in production; the
  extension store zip (0.3.0) still awaits the user's upload.
- Vision job panel requires a paid plan + Gemini key to exercise
  end-to-end against real footage; the deterministic rules carry the
  tests. First real-account vision job is a recommended smoke.
- `budget.ts` 20k-row sum cap (pre-existing, documented in cost
  model).
- Production `videos` table was empty at audit time (the morning's
  test video appears deleted) — worth the owner confirming that was
  intentional.

## Deferred intentionally

Nutrition · Trainer OS expansion · trainer payments beyond what ships
· sourcing · community expansion · TwelveLabs · full-match single-call
reads · posting OAuth integrations · server-side PDF · QR on documents.

## Addendum — vision accuracy pass (2026-08-30)

| Claim | Verdict | Evidence |
|---|---|---|
| False attribution controlled | PASS | prompt v2 confirmation runs: 0/9 (was 11 across v1 matrix); "That's not me" correction persists |
| Identity before attribution | PASS | structured pitch identity + per-match override + persisted audit + level chip |
| Routing is benchmarked, not vibes | PASS | VISION_ACCURACY_BENCHMARK.md, one variable at a time |
| Broken code-default model gone | PASS | 3.7-flash default proven on YouTube-via-Vertex; test forbids 3.6-flash regression |
| No unmetered path | PASS | deep reads consume 2 units, log tier video_deep; fallback refunds the second |
