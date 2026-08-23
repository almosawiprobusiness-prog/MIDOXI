# MIDO XI — AI System

## Principles

1. **MIDO is not a chatbot bolted on.** It is an intelligence layer over a curated football
   knowledge graph and the user's own data. Where it has no data, it says so.
2. **Never fabricate.** No invented statistics, match events, quotes or scouting observations.
   The model writes *interpretation*; facts come from curated catalogues or the user's records.
3. **AI is never on a render path.** Every generation is an explicit user action, gated by
   entitlement → quota → global budget, and metered afterwards.
4. **The product works with the AI switched off.** Every AI surface has a deterministic
   composition path that is genuinely good, not a stub.

## Layers

```
lib/ai/anthropic.ts     provider — the only module that talks to Anthropic
  ├── tier router       fast=haiku · standard=sonnet · deep=opus
  ├── structured output output_config json_schema → typed AiResult<T>, never throws
  └── circuit breaker   credit/auth failure trips a 5-minute cooldown

lib/ai/study-engine.ts  engine — composes and personalises studies
lib/data/discover.ts    engine — YouTube study discovery (pre-existing)
lib/knowledge/intent.ts router — deterministic command classification (no tokens)
```

## The truth model

| provenance | source | UI treatment |
|---|---|---|
| `verified` | `lib/knowledge/people.ts` — curated, hand-written | Blue "Verified" tag, own panel, stated as fact |
| `analysis` | Curated editorial **or** Claude | Violet "MIDO analysis" tag, explicitly a reading |
| `observation` | The user's notes and clips | Green tag, attributed to the user |

`verified` is never attached to model output. The study prompt forbids statistics, dates,
results and specific match events outright — those belong to the curated panel.

## Study composition

```
composeStudy()   deterministic, free, always available
  curated module body?        → use it (source: curated)
  otherwise                   → build from the concept graph (source: graph)
  match study / training /
  apply / quiz                → derived from curated concept material

enhanceStudy()   metered Claude pass (study_discoveries)
  checkFeature → aiAvailable → withinAiBudget → consumeFeature
  → generateJson(standard tier, strict schema)
  → merge, never overwriting curated bodies
  → logAiUsage → saveGenerated (bought once, read forever)
```

Failure at any gate returns the composed study with an honest note explaining why —
"quota used up", "model unavailable", "AI paused this month". No silent degradation.

## Command routing

`parseIntent()` classifies a typed command with regex, before any model is involved:

| input | intent | route |
|---|---|---|
| "Study Harry Kane" | `study-person` | `/app/study/harry-kane` |
| "study pressing triggers" | `study-concept` | `/app/study/concept/pressing-triggers` |
| "Study <unknown>" | `study-open` | `/app/study?q=…` — honest "not in the library" state |
| "Build me a striker session" | `build-session` | `/app/training?brief=…` |
| "review my last match" | `review-match` | `/app/matches` |
| "what should I improve?" | `development` | `/app/development` |
| "set up a 4-3-3 build-up shape" | `build` | `/app/tactics?brief=…` (via the capability registry) |
| "how much distance did I cover?" | `cannot` | a refusal with a reason, not a route |

Classification costs nothing, is unit-tested (`tests/unit/intent.test.ts` and
`tests/unit/capabilities.test.ts`), and means a paid allowance is never spent deciding where a
request belongs.

**The order is not the order the patterns are written in, and that matters:**

1. A **curated** subject wins outright — "Study Harry Kane" resolves to a real person in the library.
2. **Refusals** are checked next, before any loose pattern gets a turn.
3. Then the fast patterns, then the capability registry, then nothing.

Step 2 is the load-bearing one. *"Analyse this clip and tell me the sprint count"* mentions film, so
a film pattern will happily claim it — and the user arrives in a tool that cannot count sprints and
does not say so. The honest answer has to outrank the convenient route.

## What MIDO can and cannot build

`lib/ai/capabilities.ts` is the canonical list: **11 builders**, each naming the route that runs it,
the roles that own it, what it needs first, and whether it costs an allowance. Alongside it,
**6 explicit limits** — measurement, fixture feeds, professional statistics, injury diagnosis,
nutrition prescription, and whether someone will "make it" — each with a reason and, where a vendor
would close the gap, what it would take.

It exists because "the AI can build anything football-wise" is not a claim software can honour, and
pretending otherwise is how a product ends up with a chat box that produces confident nonsense
outside its reach. Adding a builder means adding it here; a capability with no reachable route is a
lie the tests catch. The membership page renders straight from this file, so what the product claims
about itself cannot drift from what it does.

## Club methodology injection

When a coach belongs to an organization with a written methodology, `methodologyContext()` returns
its principles — one per line — and they travel into session drafting two ways:

- **Deterministic path**: the principles become coaching points on the tactical and conditioned-game
  blocks, labelled `Club principle — …`. **Which** principles is decided by `relevantPrinciples()`,
  scored against the session's own objective and lead concept — a hard cap of three, since a block
  carrying six coaching points is a block nobody reads. The club's own leading label
  (`"Pressing — …"`) is weighted heaviest, because it is the club's categorisation of what the
  principle is *for*; document order is only the tie-breaker. This used to be `slice(0, 3)`, so a
  pressing session could carry the club's build-up principles while its pressing principle sat
  unused further down the page.
- **Metered path**: they are passed as `clubMethodology`, with a system rule that they outrank
  generic best practice and must be referenced in the coaching points.

Either way the result reports how many principles it was written inside. With nothing written, MIDO
answers generically and says so — it never implies a methodology that does not exist, and it never
writes the methodology itself.

## Role context

Every engine call receives `roleDef(role).aiPersona` — the identity MIDO adopts for a player,
coach, trainer or club — plus the reader's position, development goals and (in future phases)
club methodology. One engine, four voices, no forked prompts.

## Costs

Rates, `AiUsage`, `addUsage`, `estimateCostUsd` and `cacheSaving` live in `lib/ai/pricing.ts` —
pure and client-safe. They were previously inside the `server-only` Claude client, which meant the
one calculation the budget ceiling depends on could not be tested at all.

`logAiUsage` writes an estimate per call to `ai_usage_events`, driving both the per-user meters and
the global monthly ceiling (`AI_MONTHLY_BUDGET_USD`). Crossing the ceiling switches AI off
platform-wide while leaving every deterministic path intact.

### Prompt caching

Every engine has a long, stable system prompt — the persona, the curated football vocabulary, the
rules about what may not be claimed. It is identical between calls and dwarfs the request, which
makes it exactly what a cache breakpoint is for. `generateJson` puts one on the system block with a
1h TTL, which suits a coach drafting several sessions in a sitting and then leaving it for a day.

Cache reads are priced at **0.1×** a fresh input token and writes at **1.25×**. That asymmetry is
the whole economics: caching loses money on a prompt used once and saves an order of magnitude on
one used repeatedly. Pricing reads at the flat input rate — as this did — makes a well-cached month
look roughly ten times more expensive than it is, and because the ceiling reads that number, an
over-estimate does not merely misreport: it switches Claude off early for everyone.

### Two ways spend used to escape the ceiling

- **`discover.ts` made two Claude calls and logged neither.** The Haiku intent call's tokens
  vanished entirely, and a run that failed *after* spending them logged nothing at all. Both are
  summed now, and a failed run still logs its spend — the user is not charged an allowance for a
  failure, but ops has to see the money.
- **Cache reads were charged as fresh input**, as above.

### One bug worth remembering

`effort` and `format` are two fields of **one** `output_config` object. Building them in two places
and spreading one over the other silently replaced the schema, so **every Sonnet and Opus call ran
without its JSON schema** — the two tiers doing all the hard work — falling back to the regex that
salvages JSON out of prose. Haiku was unaffected, which is why nothing looked broken.
