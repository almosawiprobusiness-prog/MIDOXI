# MIDO XI — Repository Audit
_Audited 2026-08-21 against the Football Intelligence Operating System specification._

## 1. Verdict

The repository is **not** a throwaway. It is a real, working Next.js 16 / React 19 application
(~16.4k lines) with a genuine Supabase schema, real Claude integration, Stripe billing and a
strong, distinctive design system. It is a **single-role (player) product**. The spec requires a
**four-role operating system** (player / coach / trainer / club) with a Study Engine as the
signature feature.

**Strategy: extend, do not rebuild.** Preserve the design system, the data-adapter pattern, the AI
provider, billing and auth. Add the role layer above them and build the Study Engine as the new
intelligence core.

## 2. Stack

| Concern | Implementation | Assessment |
|---|---|---|
| Framework | Next.js 16.3 (App Router, server actions, typed `LayoutProps`) | Keep |
| UI | React 19.2, Tailwind v4 (`@theme inline`), lucide, motion | Keep |
| DB / auth | Supabase (`@supabase/ssr`), 4 migrations, RLS on every table | Keep, extend |
| AI | `@anthropic-ai/sdk` — tiered router, JSON schema output, circuit breaker | Keep, extend |
| Billing | Stripe + metered entitlements (free / pro / elite) | Keep |
| External data | YouTube Data API (`lib/ai/youtube.ts`) | Keep — first `DataProvider` |
| Tests | vitest (2 unit specs), `scripts/smoke.mjs` | Thin — expand |

Environment degrades honestly: no Supabase keys → `isDemoMode` → seed data, no persistence
(`lib/env.ts`). This is a good pattern and is retained for all new work.

## 3. What exists today

### Routes
- **Marketing / legal**: `/`, `/privacy`, `/terms`
- **Auth**: login, signup, forgot/reset password, `/auth/callback`
- **Onboarding**: `/onboarding` — 4-step wizard, role choice is **player | coach only**
- **App (player)**: `/app` (The Locker), matches (+detail), film-room (+study, collections,
  discover), training, recovery, development (+detail), performance, library (Intelligence),
  calendar, community (+posts, players), membership, profile, settings, admin
- **API**: `/api/health`, `/api/export`, `/api/stripe/webhook`

### Database (`supabase/migrations/0001–0004`)
35 tables with per-user RLS: `profiles`, `player_profiles`, `coach_profiles`, `clubs`, `teams`,
`team_memberships`, `seasons`, `matches`, `match_stats`, `match_reviews`, `videos`, `clips`,
`clip_tags`, `clip_notes`, `collections`, `collection_clips`, `study_sessions`, `study_notes`,
`saved_external_content`, `drills`, `training_sessions`, `training_blocks`, `training_logs`,
`development_goals`, `development_evidence`, `daily_checkins`, `calendar_events`,
`coach_feedback`, `notifications`, `user_preferences`, billing (`subscription_plans`,
`billing_customers`, `subscriptions`, `usage_periods`, `ai_usage_events`), AI
(`ai_recommendations`, `ai_sessions`), community (`community_posts`, `post_comments`,
`post_reactions`).

### Architecture patterns worth preserving
1. **Adapter data layer** — `lib/data/*.ts` are `server-only` modules that branch on `isDemoMode`:
   in-memory `demoStore` vs Supabase. UI never knows which. Every new domain must follow this.
2. **AI provider** — `lib/ai/anthropic.ts`: tier router (haiku/sonnet/opus), `output_config`
   JSON-schema structured output, typed `AiResult<T>` that never throws, circuit breaker with
   cooldown, honest `aiStatus()` for UI copy.
3. **Metering before AI** — `getMembership → checkFeature → withinAiBudget` runs *before* any
   Claude call; AI is never on a page-render path.
4. **Design system** — `app/globals.css` "The Film Room": graphite ink scale, violet signal,
   football semantics (positive/review/correction) used only in-context, `label-tech`,
   `stat-figure`, `data-mono`, `.panel`, `.pitch-grid`, `.field-glow`.
5. **Honest UI** — `NavItem.status: "live" | "scaffold"`, demo-content footers, AI-unavailable
   states. Preserve this discipline.

## 4. Gaps vs. the specification

| Spec | Status | Action |
|---|---|---|
| §3 Role-based OS (4 roles) | **Missing** — `Role = "player" \| "coach"`, coach has onboarding but no product | Build role layer |
| §5 Player profile / progressive profiling | Partial — profile exists, no progressive capture | Extend |
| §6 Development Map (4 areas, level→gap) | Partial — flat goals list, no map/levels/gaps | Build |
| §7–9 Study Engine (players / coaches) | **Missing** — `/app/library` is static demo data | Build (priority) |
| §10 Study→Train→Apply→Review loop | Partial — `goal-loop.tsx` is evidence only | Wire through Study |
| §11 Contextual MIDO AI | Partial — AI only inside film-room discover | Build context system |
| §12 AI command bar | Partial — `command-palette.tsx` is a static-index searcher | Build intent router |
| §13 Match Center | **Good** — CRUD, stats, reviews | Keep |
| §14 Clip intelligence | **Good** — upload, tags, collections, study sessions | Keep |
| §15 Training engine | Partial — logging exists, no context generation | Extend |
| §16–20 Coach OS | **Missing** | Phase 4 |
| §21–24 Trainer OS | **Missing** | Phase 5 |
| §25–26 Club OS + methodology | **Missing** | Phase 6 |
| §27 Knowledge graph | **Missing** | Build with Study |
| §28 Universal search | Partial — `lib/search.ts` indexes seed data only | Rebuild over graph |
| §30 Football data providers | Partial — YouTube only, no `FootballDataProvider` interface | Interface + stub |
| §31 Verified / analysis / observation separation | **Missing** | Core of Study Engine |
| §39 Multi-tenancy | Partial — clubs/teams/memberships tables exist, unused | Extend + enforce |

## 5. Technical debt / honesty issues found

1. **`app/app/library/page.tsx`** renders `lib/data/demo.ts` static arrays as if they were the
   user's study data — the biggest violation of spec §40. It is being replaced by the Study Engine.
2. **`lib/data/demo.ts`** (171 lines) mixes fictional-but-labelled demo data into three live pages
   (performance, recovery, profile dossier). Acceptable short-term because it is footer-labelled,
   but performance/recovery must move to real adapters.
3. **`lib/search.ts`** imports `lib/seed.ts` at module scope — search results are seed data even
   for real accounts.
4. **`lib/types.ts`** `Role` union blocks the whole role architecture — first thing to change.
5. **README** is still the `create-next-app` boilerplate.
6. **Test coverage** is two trivial unit specs; no coverage of billing gates, RLS, or AI fallbacks.
7. `components/shell/sidebar.tsx` imports `player` from `lib/seed` — identity card is hardcoded
   seed data rather than the signed-in user.

## 6. Reusable inventory (do not rebuild)

`components/ui/kit.tsx` — `PageHeader`, `StatBand`, `MiniBars`, `ProgressRow`, `Radial`,
`FormPips`. `components/ui/primitives.tsx` — `SectionHeader`, `categoryStyle`, `sentimentStyle`,
`Meter`. Shell: `app-shell`, `sidebar`, `topbar`, `mobile-nav`, `command-palette`,
`section-scaffold`. Dialogs/forms across matches, training, development, film, calendar.
All are role-agnostic and reusable by coach/trainer/club surfaces.
