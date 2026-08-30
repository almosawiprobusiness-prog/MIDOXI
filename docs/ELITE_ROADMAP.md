# Elite Roadmap — the phased evolution of the Player OS

**Principle:** the goal is not more features. The goal is deeper
interconnection — every phase strengthens an arrow in the loop:

```
MATCH → FILM → DEVELOPMENT → STUDY → AI TRAINING → PERFORMANCE
  → PLAYER MEMORY → NEXT BEST ACTION → MATCH
```

Ground rules carried from the codebase: no invented statistics; player
confirms before anything is written; metered AI is refunded on
not-their-fault failure; RLS verified from the outside; every phase ends
green (typecheck + tests + build) and committed.

---

## Phase 1 — AI Training (the STUDY → AI TRAINING arrow)

The market sells the same week to everyone (Techne, Beast Mode). We
derive the week from the player's actual record.

- **Context selector** (`lib/intelligence/context.ts`) — the one
  unbuilt step (7) of the event-intelligence spec. What MIDO is told
  about a player when a model *is* called: active goals, recent film
  observations by concept, readiness, memory block — assembled from the
  same signals as the NBA scorer, not a second pipeline.
- **Session generator** — an AI-proposed individual training session
  that names *why* each block exists ("your goal", "the third clip
  where…", "readiness is low, so…"). Player confirms before it is
  saved; unmentioned stays null; metered as `ai_interactions`.
- **Close the arrow:** completing a generated session emits
  `TRAINING_LOGGED` with the linkage, so NBA and reports can say
  "trained what the film showed."

## Phase 2 — Film Room (the MATCH → FILM → DEVELOPMENT arrows)

- Study captures (extension) surface as a **review queue** in the Film
  Room, each dispatchable into a study or a development observation.
- Concept threading: observations for the same concept link across
  clips, feeding the "fourth clip where this happens" claim
  arithmetically.

## Phase 3 — Study (the DEVELOPMENT → STUDY arrow)

- Studies recommend themselves from goals: an active goal's concepts
  pull matching curated studies into the NBA candidate set.
- Study completion writes evidence toward the goal it served
  (player-confirmed), so studying visibly moves the development thread.

## Phase 4 — Matches & the favorite club (the MATCH and STUDY arrows)

- **Favorite club** on the profile: the club a player supports and
  studies. Their fixtures become *watch assignments* — "watch how their
  left-back handles X" — turning fandom into structured study.
- Match-watch studies: a lightweight study type for watching a pro
  match with a focus question, logged like any study, feeding the loop.

## Phase 5 — Development, NBA & the Locker (the MEMORY → NBA arrow)

- **Timeline parity tooling** (spec step 10): read-only comparison of
  `player_timeline` vs the event log; the switch itself remains a
  stop-and-decide.
- **Demo fixture clock**: derive the seeded fixture from a demo anchor
  so `match_prep` fires in the only environment without keys.
- **Empty-state sequencing** (beta-gate FAIL): every panel orders the
  first action instead of saying "nothing yet."

## Phase 6 — Community (the loop made social)

- Squad-visible studies and goals (opt-in per item, RLS-enforced):
  teammates see *that* you studied, coaches see what you choose to
  share. No public feed, no strangers.

## Phase 7 — Social creation (PERFORMANCE leaves the app)

- Shareable match-report and milestone graphics rendered from real
  logged data (the photo-grading/static-render techniques from prior
  MIDO projects apply). Nothing invented; privacy defaults to nothing
  personal, like reports.

## Phase 8 — Trainer OS (the Lab becomes a business)

- **Payments:** Stripe Connect so a trainer bills their players inside
  the product — CoachIQ's wedge, attached to the player's own record,
  which CoachIQ cannot offer.
- **Branding:** trainer name/mark on session plans and shared reports.
- Roster: the trainer's players, each a real Player OS account the
  player owns.

## Phase 9 — Final Player OS polish (the gate, again)

- Nav cut list (`docs/fable/PLAYER_OS_CUT_LIST.md`) — surfaced as a
  product decision with a recommendation, then executed.
- Mobile long-tail audit (reports, settings), UTC day-counting fix via
  profile timezone, remaining beta-gate LATERs re-graded.

---

## Sequencing logic

1–5 deepen the player loop (the thesis's moat) before anything social
or commercial. 6–7 make the loop visible to others only once it is
worth seeing. 8 monetizes the trainer channel only after the player
record it sells against is genuinely elite. 9 is the same beta-gate
standard applied to the whole, again, before wider release.
