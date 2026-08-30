# Feature Decisions

Build / don't-build calls for the elite roadmap, with the reasoning
pinned so they are not re-litigated. Companion to `ELITE_ROADMAP.md`;
inherits every decision already recorded in
`docs/fable/PLAYER_OS_CUT_LIST.md` and the intelligence docs.

## BUILD

| Decision | Why |
|---|---|
| **Context selector before session generator** | Same reason the NBA scorer preceded the recommendation model: the part that decides quality (what the model is told) gets pinned by tests before anything depends on it. One signal pipeline, not two. |
| **Generated sessions are proposals, player-confirmed** | Same contract as voice logging and film evidence: nothing writes without confirmation. A training plan silently written is a plan silently ignored. |
| **Every generated block names its source** | "Why this?" is already the NBA standard. A session block that cannot cite a goal, observation, or readiness figure gets cut from the generation, not decorated with a vague reason. |
| **Favorite club as structured study, not fandom decoration** | Watching football is the cheapest high-volume study input a player has. A focus question turns it into loop data; a badge on a profile would be noise. |
| **Squad sharing opt-in per item** | The record is the player's. Default-visible would make honest logging unsafe; per-item opt-in keeps the record honest and the sharing intentional. |
| **Stripe Connect for trainers (Phase 8)** | CoachIQ proves trainers switch platforms for integrated payments alone. It attaches the business to the player-owned record — our moat, their wedge. |
| **Social graphics rendered from logged data only** | Marketing surface with zero fabrication risk; privacy model copied from reports (nothing personal by default). |

## DON'T BUILD

| Decision | Why |
|---|---|
| **No drill/content library** | MOJO sells content at $59.99/yr; it is a commodity race. Our sessions are derived from the record — that is the differentiation; a library would erase it. **Re-affirmed 30 Aug 2026 (intelligence phase):** the quality lever is the curated concept graph's vocabulary (cues/trains/looksLike), enriched as needed — never sellable drill content. See AI_TRAINING_ENGINE.md. |
| **No automated 90-minute match analysis** | Player identity on film is unsolved and the model lies about it (tested on real footage, documented in memory and VIDEO_INTELLIGENCE.md). Beta gate already forbids UI implying it. |
| **No public community / feed / strangers** | Feed engagement is a different product with different incentives. Community = squad visibility of loop artifacts, nothing more. |
| **No capture hardware ambitions** | Veo/Hudl/Trace own that capital-intensive fight; we ingest their output for free. |
| **No wearable integrations beyond existing WHOOP sync** | Per the phase-15 list; check-in readiness already feeds the scorer, and an untestable emitter is a log that might be lying. |
| **No PDF engine** | `@media print` already ships three report types; a PDF library adds a dependency to replicate the browser. **Re-affirmed 30 Aug 2026 (intelligence phase), reinterpreted:** browser print IS a vector-PDF pipeline; the phase's work was document design (the per-session training plan), not a library. Server-side PDF remains gated on the email requirement per REPORT_ENGINE.md. |
| **No new design system** | Big Shoulders display voice + command surfaces just unified the product; the roadmap builds inside it. |
| **No invented streak mechanics** | Techne's streaks work on volume the player *chose* to log. Surfacing real volume (minutes, sessions, studies) is in scope; gamifying with synthetic points is not — it pollutes the record the AI reads. |

## DECIDE-WITH-USER (stop points, per the autonomy rule)

| Item | When |
|---|---|
| Nav cut list execution (18 → ~7 destinations) | Phase 9 — cutting is a product decision, not done unilaterally |
| `player_timeline` → event-log switch | Only after parity tooling (Phase 5) reports, and then only with sign-off |
| ~~Trainer OS pricing & Connect fee structure~~ | **DECIDED 30 Aug 2026: Option B, volume-tiered downward** — 2% to 5 active athletes, 1.5% at 6, 1% at 16+. Growth shrinks the platform's slice. See `TRAINER_OS_PAYMENTS.md` |
