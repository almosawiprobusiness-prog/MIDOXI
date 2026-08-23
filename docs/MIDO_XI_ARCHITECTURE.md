# MIDO XI — Architecture

## Layers

```
app/                     route surfaces (server components by default)
  (auth)/ onboarding/ app/
components/              presentation; role-agnostic where possible
lib/
  roles/                 ROLE REGISTRY — the transformation layer
  knowledge/             football knowledge graph (people, concepts, edges)
  ai/                    Claude provider + engines (study, command router)
  data/                  adapters: demo store  |  Supabase
  billing/ auth/ env.ts  cross-cutting
supabase/migrations/     schema + RLS
```

## The role system

`lib/roles/roles.ts` is the single source of truth. A `RoleDefinition` carries:

- `id`, `label`, `tagline`, `icon`
- `nav: NavItem[]` — the sidebar for that role
- `terminology: Record<TermKey, string>` — "Squad" vs "Roster" vs "Teams"
- `quickActions` — the role's primary verbs
- `aiPersona` — the system-prompt identity MIDO adopts for that role
- `home` — dashboard component route

Adding a role means adding a registry entry plus its dashboard; it never means forking the app.
Shared domain modules (`lib/data/*`) are role-neutral; authorization decides *which rows*, the role
decides *which presentation*.

Users may hold several roles. `profiles.role` is the **active** role; `org_memberships` +
`*_profiles` rows describe what a user *may* be. `switchRole()` changes the active role only.

## Data access

Every domain module exports async functions that branch once on `isDemoMode`:

```ts
export async function listX(): Promise<X[]> {
  if (isDemoMode) return demoStore.listX();
  const supabase = await createClient(); if (!supabase) return [];
  ...
}
```

Server actions call these; components never touch Supabase directly.

## Knowledge graph

Nodes: `FootballPerson` (player | coach), `FootballConcept`, `Position`, `Drill`.
Edges are typed and directional: `embodies`, `requires`, `counters`, `trains`, `partOf`,
`playedBy`, `coachedBy`. The graph is code-seeded (curated, reviewable) rather than AI-generated,
so relationships are stable and citable. AI *traverses and explains* the graph; it does not invent
it.

## Truth model (spec §31) — non-negotiable

Every study block carries a `provenance`:

| provenance | meaning | source |
|---|---|---|
| `verified` | stable public record (club, position, honours, role) | curated catalogue in `lib/knowledge/people.ts` |
| `analysis` | MIDO's football interpretation | Claude, explicitly labelled in the UI |
| `observation` | the user's own note or clip | user input |

The UI renders these differently and never presents `analysis` as fact. No AI-generated statistics
are displayed as data.

## AI system

Provider → engine → adapter. `lib/ai/anthropic.ts` stays the only place that talks to Anthropic.
Engines (`study-engine.ts`, later `command-router.ts`, `session-generator.ts`) own prompts and
schemas. Every engine call: membership gate → budget gate → `generateJson` → meter → persist.
Failures degrade to curated/heuristic content, never to a crash or an empty screen.

## Multi-tenancy

`organizations` → `org_memberships (user, org, role, team?)` → `teams`. Coaches see players via
`coach_players`; trainers via `trainer_athletes`; clubs via org membership. RLS enforces each edge
in Postgres — the app never relies on UI hiding alone.

## The seed-data rule

Every page reads through an adapter in `lib/data/` that branches **once** on `isDemoMode` and
returns identical shapes on both sides. There is exactly one acceptable reason for a page to import
`lib/seed` directly: it is already inside an `isDemoMode` branch.

This is written down because it was violated for a long time, invisibly, in the worst possible
places. Performance, Recovery and Profile imported a hardcoded `lib/data/demo.ts` with **no branch
at all**, so real accounts saw a fictional player's season, invented per-90s, HRV and hydration
readings that cannot be entered anywhere in the product, and attribute ratings out of 100 that
nothing in MIDO assesses. `lib/search.ts` built its ⌘K index at module scope from the same seed, so
every account searched a fictional player's memory. The Match Center rendered a seeded upcoming
fixture unconditionally, and the match detail page named every user's club from a seed constant.

None of it crashed, so none of it surfaced. The check that catches it is not a test — it is
`grep -rn 'lib/seed' app/ components/` and then asking of each hit: *is this inside a demo branch?*

## Deriving, not inventing

Where a figure could be modelled, it is instead derived from something the user recorded, and the
threshold for showing it at all is explicit:

- A **per-90** needs at least 2 matches and 90 minutes with the stat recorded, or it is not shown.
  A rate from one twenty-minute cameo describes the cameo.
- **Readiness** is the mean of four self-reported 1–5 scores with soreness flipped — and the page
  says so, because a number about your own body should be one you can check. Below two fields
  answered it returns `null`, not a guess.
- The **Development Map**'s current/target/gap are redefined as evidence / the goal you set / the
  next concrete thing to do. There is no ability rating on it, because nothing in MIDO rates
  ability.
- A blank stat is **never** counted as a zero.

Each of these pages also carries a panel naming what MIDO does *not* hold and what would be needed
for it — the same discipline as `TRACKING_GAP` and `PAYOUT_GAP`.
