# MIDO XI — Build Plan

Persistent project memory. Each phase lists intent, files, and the definition of done.
Update `MIDO_XI_PROGRESS.md` after every completed phase.

## Guiding rules
1. **Extend, don't rebuild.** The player OS, design system, AI provider, billing and auth stay.
2. **Shared intelligence engine + role experience layers.** One domain core, four presentations.
3. **No fake functionality.** If it can't be real yet, build the architecture and mark the
   integration point in the UI. Never invent player statistics or scouting observations.
4. **Every data module is an adapter** — `isDemoMode` branch, same shape both sides.
5. **AI never runs on a render path** and always passes membership + budget gates first.

---

## PHASE 1 — FOUNDATION (role architecture)  ✅
**Intent:** the application transforms around who you are.

- `lib/roles/roles.ts` — `RoleId = player | coach | trainer | club`, role registry: label,
  tagline, terminology map, home route, nav, quick actions, AI persona.
- `lib/types.ts` — widen `Role`; add `Organization`, `Membership`, `RoleProfile` shapes.
- `supabase/migrations/0005_roles_intelligence.sql` — widen `profiles.role`; add
  `trainer_profiles`, `club_profiles`, `organizations`, `org_memberships`, `coach_players`,
  `trainer_athletes`; add Study/knowledge tables; RLS for all.
- `lib/auth/session.ts` — `activeRole`, `availableRoles`, `switchRole()`.
- `lib/nav.ts` — `navForRole(role)`.
- Shell — sidebar, mobile nav, topbar, command palette all role-aware; role switcher.
- `/onboarding` — four-way role selection with role-specific steps.
- `/app` — dispatches to a role dashboard.

**Done when:** signing in as each role yields a different navigation, dashboard, terminology and
AI context, from one shared codebase.

## PHASE 2 — PLAYER CORE  ✅ complete
Match Center, Film Room, Training, Recovery, Development, Calendar, Profile all exist.

- **Development Map** ✅ — `lib/data/development-map.ts`, on `/app/development`. Current → target →
  gap across all five categories, with every term redefined so nothing has to be invented: current
  is what the evidence says, target is the goal the player set, gap is the next concrete thing to
  do. **No ability ratings**, because MIDO does not assess. Its most useful output is coverage —
  which parts of the game are being worked on and which are being ignored.
- **Daily briefing** ✅ — `lib/data/briefing.ts`, top of the Locker. Rules over facts the product
  already holds: free, instant, identical every time, and every line traceable to its cause. Not an
  AI feature, on purpose — spending a model call to restate held facts costs money and adds doubt.
  Readiness is derived with the *same* arithmetic the Recovery page uses, so the two cannot
  contradict each other on the same morning.
- **Progressive profiling** ✅ — `lib/data/profiling.ts`, one prompt on the Locker. Asks for a single
  field at a time and states what it unlocks; nothing is asked for unless a real behaviour is
  degraded. Silent for a complete profile.

## PHASE 3 — STUDY INTELLIGENCE (signature)  ✅ core
**Intent:** learn football through the best people in football.

- `lib/knowledge/people.ts` — curated `FootballPerson` catalogue (players + coaches) with
  **verified** facts only (career facts that are stable public record), plus study module hints.
- `lib/knowledge/concepts.ts` — `FootballConcept` nodes + typed relationships = the knowledge graph.
- `lib/knowledge/graph.ts` — traversal, related-concept lookup, position relevance.
- `lib/ai/study-engine.ts` — Claude-generated study modules, schema-validated, personalised to the
  reader's role/position/goals; every block tagged `verified | analysis | observation`.
- `lib/data/studies.ts` — adapter: create/list/get studies, module cache, progress, quiz results.
- `/app/study` — the Study Engine home: command input ("Study Harry Kane"), subject catalogue,
  in-progress studies, concept index.
- `/app/study/[slug]` — the study itself: DNA → modules → match study → take into training →
  knowledge check → apply to my game.
- Actions: **Take into training** creates a real training session; **Apply to my game** creates a
  real development goal; **Knowledge check** persists a score.

**Done when:** typing "Study Harry Kane" produces a personalised, sourced, multi-module study that
ends in a training session and a development goal actually written to the user's account.

## PHASE 4 — COACH OS  ✅
Squad management with development history, Session Planner (objective → blocks, MIDO draft),
Tactical Board (SVG canvas, formations, arrows, zones), Opposition workspace → Match Plan built only
from recorded observations. Remaining: player↔coach account linking, boards attached to sessions.

## PHASE 5 — TRAINER OS  ✅
Athlete roster with a dated record, Program Builder (waved blocks, deloads, retest weeks),
Assessments with direction-aware trends and retest prompts, Trainer AI. Remaining: readiness from
linked athlete check-ins rather than trainer-entered fields.

## PHASE 6 — CLUB OS  ✅
Organizations → teams → staff → players. Club Methodology documents (how we play / train /
develop). Methodology-aware AI. Development trend intelligence.

## PHASE 7 — VIDEO + ADVANCED INTELLIGENCE  ▲ frame reading done
Clip annotations at timestamps, analysis job infrastructure (no fake CV), deeper personalization
signals, `FootballDataProvider` implementations.

## PHASE 8 — POLISH  ← next
Mobile-first passes on Daily MIDO / training / match logging / study, motion, a11y, empty and
loading states, QA, tests.

---

## Status log
See `MIDO_XI_PROGRESS.md`. Phases 1, 3 (core), 4, 5 and 6 complete (2026-08-21). Phase 2 partially complete.
