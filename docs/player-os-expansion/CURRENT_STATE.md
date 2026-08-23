# Player OS — current state

Audited by inspection on 2026-08-22: routes read from the role registry, tables
from the migrations, capabilities from `package.json` and the source. Nothing
here is taken from earlier documentation.

## What a player can reach

| route | status |
|---|---|
| `/app` The Locker | live — briefing, next match, readiness, week, focus |
| `/app/matches` | live — full CRUD, stats, self-review |
| `/app/training` | live — sessions, load, RPE |
| `/app/development` | live — goals, evidence loop, development map |
| `/app/study` | live — curated people + concepts, 5-stage loop |
| `/app/film-room` | live — videos, clips, tags, collections, frame reads |
| `/app/recovery` | live — 4-score check-in, derived readiness |
| `/app/performance` | live — per-90 from recorded stats, workload |
| `/app/calendar` | live |
| `/app/community` | live |

66 tables. 48 data adapters. Every page reads through an adapter that branches
once on demo mode.

## Feature-by-feature verdict

| requested capability | verdict | detail |
|---|---|---|
| Video upload + storage | **EXISTS** | `videos`/`clips`, Supabase `videos` bucket, upload + YouTube + URL |
| Video clipping, tagging, notes | **EXISTS** | `clips`, `clip_tags`, `clip_notes`, collections |
| AI video analysis | **PARTIAL** | `clip_analyses` + frame-reading provider. **Client-side capture, 12 frames max, ≤24s range.** Stills only — no temporal reasoning |
| Video annotation (draw/arrows) | **MISSING** | no drawing layer |
| Player timeline | **MISSING** | data exists across tables; nothing assembles it chronologically |
| Development ↔ video link | **PARTIAL** | `clips.goal_id` and `development_evidence` exist; nothing auto-links a video observation to a goal |
| Football knowledge graph | **EXISTS, SMALL** | 25 concepts, 32 typed edges, 11 people. Curated, not generated |
| Professional-player study | **EXISTS** | study → understand → train → apply → review, all 5 write real rows |
| AI memory | **PARTIAL** | `ai_sessions`, `ai_recommendations`, `development_evidence`. **No vector store, no durable player memory** — each engine call rebuilds context from tables |
| Personalisation / next best action | **PARTIAL** | `lib/data/briefing.ts` is rules-over-facts and explains itself. No cross-signal ranking |
| Proactive MIDO | **PARTIAL** | the briefing is proactive; nothing runs when the app is closed |
| Deep player profile | **PARTIAL** | `player_profiles` has 14 fields. No technical/tactical/mental assessment, no career history |
| Data confidence / provenance | **MISSING** | no source field anywhere. `physical.ts` already refuses invented norms — the discipline exists, the schema doesn't |
| Reports / PDF | **MISSING** | zero PDF libraries |
| Email | **MISSING** | `RESEND_API_KEY` empty, no send path |
| Social share cards | **MISSING** | none |
| Multilingual | **MISSING** | zero i18n libraries. English hardcoded in ~60 components |
| External sharing / permissions | **PARTIAL** | `invites` + `accept_invite` + scope-keyed RLS exist for coach/trainer/club links. No per-artefact share, no expiry, no public link |
| QR profile | **MISSING** | — |
| Integrations (health, GPS, match data) | **MISSING** | only YouTube search |
| Voice input | **MISSING** | — |
| Camera / smart import | **MISSING** | — |
| Career mode / player CV | **MISSING** | — |
| Comparison engine | **MISSING** | — |
| Offline mode | **MISSING** | no service worker |
| Player card | **MISSING** | — |

## Dependencies

```
@anthropic-ai/sdk  @supabase/ssr  @supabase/supabase-js  clsx
lucide-react  motion  next  react  react-dom  stripe  tailwind-merge  zod
```

Twelve. No PDF, no i18n, no email, no queue, no CV, no vector store. Every
capability in this brief that needs one of those is genuinely absent, not
half-built.

## What is stronger than expected

**The honesty layer is already load-bearing and would be expensive to retrofit.**
`lib/ai/capabilities.ts` (11 builders, 6 explicit refusals), `TRACKING_GAP`,
`NOT_RECORDED`, `NOT_MEASURED`, the three-way truth model
(`verified` / `analysis` / `observation`), and the per-90 thresholds that refuse
thin evidence. Any expansion has to inherit this or it will feel like a
different product.

**The evidence loop is real.** Development progress moves only when evidence is
attached. That is the spine everything else should hang from.

**The metering and honesty of the AI layer.** Gate → budget ceiling → consume →
log, with a deterministic free path behind every AI surface.

## What is weaker than it looks

**Video analysis is much thinner than the schema suggests.** `clip_analyses`
implies a general capability. What exists is 12 JPEG stills captured in the
browser, ≤24 seconds, sent to Claude as images. It cannot watch a video.

**There is no player memory.** Every AI call reassembles context from SQL. A
player's history influences nothing beyond what a query returns.

**No job queue.** Everything is request-scoped. Any real video pipeline needs
one; this is the single biggest architectural gap for the expansion.
